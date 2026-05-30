using System.Text.Json;
using System.Text.Json.Serialization;
using Lights.Api;
using Lights.Core;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ISessionStore, InMemorySessionStore>();

// --- Auth0: JWT bearer validation -------------------------------------------
// The clinician (controller) authenticates via the Angular SPA; the headset
// client stays anonymous. We validate access tokens issued by the Auth0 tenant
// for our API audience. Config comes from env: Auth0__Domain, Auth0__Audience.
var auth0Domain = builder.Configuration["Auth0:Domain"];
var auth0Audience = builder.Configuration["Auth0:Audience"];
var authConfigured = !string.IsNullOrWhiteSpace(auth0Domain) && !string.IsNullOrWhiteSpace(auth0Audience);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authConfigured ? $"https://{auth0Domain}/" : null;
        options.Audience = auth0Audience;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = authConfigured,
            ValidateAudience = authConfigured,
            ValidateIssuerSigningKey = authConfigured,
            NameClaimType = "sub",
        };

        // SignalR caveat: browsers can't set an Authorization header on the
        // WebSocket handshake, so the token arrives in the query string. Pull it
        // out for /hubs/* requests (standard SignalR + JWT pattern).
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();

// When Auth0 isn't configured (local dev), enforcement is off so the controller
// can run anonymously — the SPA suppresses its login UI to match. In prod the
// env vars are set, so the controller path requires a valid clinician token.
builder.Services.AddSingleton(new AuthEnforcement(authConfigured));

builder.Services
    .AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PayloadSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// CORS: the management (4200) and client (5173) dev servers call the API and hub
// from other origins. In prod, Caddy serves the front-ends same-origin so CORS
// isn't exercised — but we keep a tight allowlist regardless. Origins come from
// the Cors__AllowedOrigins env var (comma/space-separated); dev defaults included.
const string CorsPolicy = "lights-cors";
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty)
    .Split([',', ' ', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Concat(["http://localhost:4200", "http://localhost:5173", "https://app.lumessa.xyz", "https://join.lumessa.xyz"])
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// Controller creates a session and receives a code + QR-able join URL. Only an
// authenticated clinician may create a session; it's stamped with their `sub`.
var createSession = app.MapPost("/api/sessions", (ISessionStore store, IConfiguration config, HttpContext http) =>
{
    var ownerSub = http.User.FindFirst("sub")?.Value;
    var session = store.Create(TimeSpan.FromHours(1), ownerSub);
    var clientBase = (config["Client:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
    return Results.Ok(new
    {
        sessionId = session.Id,
        code = session.Code,
        joinUrl = $"{clientBase}/?code={session.Code}",
        expiresAt = session.ExpiresAt,
    });
});
// Only require auth when Auth0 is configured; dev (no env vars) stays anonymous.
if (authConfigured) createSession.RequireAuthorization();

// Lightweight existence check for the client's manual code entry.
app.MapGet("/api/sessions/{code}", (string code, ISessionStore store) =>
{
    var session = store.GetByCode(code);
    return session is null
        ? Results.NotFound(new { error = "not_found" })
        : Results.Ok(new { sessionId = session.Id, expiresAt = session.ExpiresAt });
});

app.MapHub<ControlHub>("/hubs/control");

app.Run();
