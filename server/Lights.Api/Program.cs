using System.Text.Json;
using System.Text.Json.Serialization;
using Lights.Api;
using Lights.Core;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ISessionStore, InMemorySessionStore>();

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

// DEV CORS: the management (4200) and client (5173) dev servers call the API and
// hub from other origins. Lock this down to known origins per-environment later.
const string DevCorsPolicy = "dev-cors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevCorsPolicy, policy => policy
        .SetIsOriginAllowed(_ => true)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var app = builder.Build();

app.UseCors(DevCorsPolicy);

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// Controller creates a session and receives a code + QR-able join URL.
app.MapPost("/api/sessions", (ISessionStore store, IConfiguration config) =>
{
    var session = store.Create(TimeSpan.FromHours(1));
    var clientBase = (config["Client:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
    return Results.Ok(new
    {
        sessionId = session.Id,
        code = session.Code,
        joinUrl = $"{clientBase}/?code={session.Code}",
        expiresAt = session.ExpiresAt,
    });
});

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
