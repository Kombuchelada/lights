namespace Lumessa.Core;

/// <summary>A controller↔client pairing. Connection ids and last state are set by the hub.</summary>
public sealed class Session
{
    public required string Id { get; init; }
    public required string Code { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }

    /// <summary>
    /// The authenticated controller (Auth0 <c>sub</c>) that owns this session.
    /// Sessions are account-scoped: only this user may (re)join as the controller.
    /// </summary>
    public string? OwnerSub { get; init; }

    public string? ControllerConnectionId { get; set; }
    public string? ClientConnectionId { get; set; }

    /// <summary>Last validated state, replayed to a client when it (re)joins.</summary>
    public LightState? LastState { get; set; }
}
