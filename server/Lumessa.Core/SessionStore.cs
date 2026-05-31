using System.Collections.Concurrent;

namespace Lumessa.Core;

public interface ISessionStore
{
    Session Create(TimeSpan ttl, string? ownerSub = null);
    Session? Get(string id);
    Session? GetByCode(string code);
    void Remove(string id);
    int PurgeExpired();
}

/// <summary>
/// In-memory session store for the prototype. Single-instance only — swap for a
/// distributed store (e.g. Redis) alongside Azure SignalR when scaling out.
/// </summary>
public sealed class InMemorySessionStore : ISessionStore
{
    private readonly ConcurrentDictionary<string, Session> _byId = new();
    private readonly ConcurrentDictionary<string, string> _codeToId = new(StringComparer.OrdinalIgnoreCase);
    private readonly TimeProvider _clock;

    public InMemorySessionStore(TimeProvider? clock = null) => _clock = clock ?? TimeProvider.System;

    public Session Create(TimeSpan ttl, string? ownerSub = null)
    {
        var now = _clock.GetUtcNow();
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var code = SessionCode.Generate();
            if (_codeToId.ContainsKey(code)) continue;

            var session = new Session
            {
                Id = Guid.NewGuid().ToString("n"),
                Code = code,
                CreatedAt = now,
                ExpiresAt = now + ttl,
                OwnerSub = ownerSub,
            };

            if (_codeToId.TryAdd(code, session.Id))
            {
                _byId[session.Id] = session;
                return session;
            }
        }

        throw new InvalidOperationException("Could not allocate a unique session code.");
    }

    public Session? Get(string id) =>
        _byId.TryGetValue(id, out var session) && !IsExpired(session) ? session : null;

    public Session? GetByCode(string code)
    {
        var normalized = SessionCode.Normalize(code);
        if (normalized.Length == 0) return null;
        return _codeToId.TryGetValue(normalized, out var id) ? Get(id) : null;
    }

    public void Remove(string id)
    {
        if (_byId.TryRemove(id, out var session)) _codeToId.TryRemove(session.Code, out _);
    }

    public int PurgeExpired()
    {
        var removed = 0;
        foreach (var entry in _byId)
        {
            if (IsExpired(entry.Value))
            {
                Remove(entry.Key);
                removed++;
            }
        }
        return removed;
    }

    private bool IsExpired(Session session) => _clock.GetUtcNow() >= session.ExpiresAt;
}
