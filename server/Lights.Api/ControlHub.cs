using Lights.Core;
using Microsoft.AspNetCore.SignalR;

namespace Lights.Api;

/// <summary>Result returned to a caller of <see cref="ControlHub.JoinSession"/>.</summary>
public sealed record JoinResult(string SessionId, string Role, LightState? State);

/// <summary>
/// Whether Auth0 is configured. When false (local dev, no env vars), the hub
/// skips the controller-auth check so the controller can run anonymously.
/// </summary>
public sealed record AuthEnforcement(bool Enabled);

/// <summary>
/// Realtime control hub. A controller and a client both join the SignalR group
/// for a session; the controller's validated state is relayed to the client.
/// See docs/protocol.md for the contract.
/// </summary>
public sealed class ControlHub : Hub
{
    private const string SessionIdKey = "sessionId";
    private const string RoleKey = "role";

    private readonly ISessionStore _store;
    private readonly ILogger<ControlHub> _logger;
    private readonly AuthEnforcement _auth;

    public ControlHub(ISessionStore store, ILogger<ControlHub> logger, AuthEnforcement auth)
    {
        _store = store;
        _logger = logger;
        _auth = auth;
    }

    public async Task<JoinResult> JoinSession(string code, string role)
    {
        var session = _store.GetByCode(code)
            ?? throw new HubException("Session not found or expired.");

        role = role == "client" ? "client" : "controller";

        // The headset client joins anonymously; the controller must be the
        // authenticated clinician that owns this session. We don't put a blanket
        // [Authorize] on the hub — that would block the anonymous client — so we
        // gate the controller path here instead. Skipped when Auth0 is unconfigured.
        if (role == "controller" && _auth.Enabled)
        {
            if (Context.User?.Identity?.IsAuthenticated != true)
            {
                throw new HubException("Authentication required to control a session.");
            }

            var sub = Context.User.FindFirst("sub")?.Value;
            if (session.OwnerSub is { } owner && owner != sub)
            {
                throw new HubException("This session belongs to a different account.");
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(session.Id));
        Context.Items[SessionIdKey] = session.Id;
        Context.Items[RoleKey] = role;

        if (role == "controller")
        {
            session.ControllerConnectionId = Context.ConnectionId;
            if (session.ClientConnectionId is { } clientId)
            {
                await Clients.Client(clientId).SendAsync("ControllerJoined");
            }
        }
        else
        {
            session.ClientConnectionId = Context.ConnectionId;

            // Immediate sync with the last known state, if any.
            if (session.LastState is { } last)
            {
                await Clients.Caller.SendAsync("ReceiveState", last);
            }

            // Nudge the controller to push a fresh snapshot.
            if (session.ControllerConnectionId is { } controllerId)
            {
                await Clients.Client(controllerId)
                    .SendAsync("ClientJoined", new { connectionId = Context.ConnectionId });
            }
        }

        _logger.LogInformation("{Role} joined session {SessionId}", role, session.Id);
        return new JoinResult(session.Id, role, session.LastState);
    }

    public async Task SendState(LightState state)
    {
        if (!Context.Items.TryGetValue(SessionIdKey, out var sidObj) || sidObj is not string sessionId)
        {
            throw new HubException("Join a session before sending state.");
        }

        if (Context.Items.TryGetValue(RoleKey, out var roleObj) && roleObj as string != "controller")
        {
            throw new HubException("Only the controller may send state.");
        }

        var session = _store.Get(sessionId)
            ?? throw new HubException("Session not found or expired.");

        var clean = ProtocolLimits.Sanitize(state);
        session.LastState = clean;
        await Clients.OthersInGroup(GroupName(sessionId)).SendAsync("ReceiveState", clean);
    }

    /// <summary>
    /// Client → controller echo-back. The client calls this after rendering a
    /// state, passing back its <c>ts</c>; we relay it to the controller as
    /// <c>StateRendered</c> so the controller can confirm the headset rendered
    /// the frame (and measure round-trip latency).
    /// </summary>
    public async Task AckState(long ts)
    {
        if (!Context.Items.TryGetValue(SessionIdKey, out var sidObj) || sidObj is not string sessionId)
        {
            return; // not joined — nothing to confirm
        }

        var session = _store.Get(sessionId);
        if (session?.ControllerConnectionId is { } controllerId)
        {
            await Clients.Client(controllerId).SendAsync("StateRendered", new { ts });
        }
    }

    public Task LeaveSession() => OnDisconnectedAsync(null);

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue(SessionIdKey, out var sidObj) && sidObj is string sessionId)
        {
            var session = _store.Get(sessionId);
            var role = Context.Items.TryGetValue(RoleKey, out var r) ? r as string : null;

            if (session is not null)
            {
                if (role == "controller" && session.ControllerConnectionId == Context.ConnectionId)
                {
                    session.ControllerConnectionId = null;
                    if (session.ClientConnectionId is { } clientId)
                    {
                        await Clients.Client(clientId).SendAsync("ControllerLeft");
                    }
                }
                else if (role == "client" && session.ClientConnectionId == Context.ConnectionId)
                {
                    session.ClientConnectionId = null;
                    if (session.ControllerConnectionId is { } controllerId)
                    {
                        await Clients.Client(controllerId).SendAsync("ClientLeft");
                    }
                }
            }

            Context.Items.Remove(SessionIdKey);
            Context.Items.Remove(RoleKey);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private static string GroupName(string sessionId) => $"session:{sessionId}";
}
