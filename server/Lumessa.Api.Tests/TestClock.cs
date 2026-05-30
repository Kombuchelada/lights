namespace Lumessa.Core.Tests;

/// <summary>A controllable <see cref="TimeProvider"/> for deterministic expiry tests.</summary>
internal sealed class TestClock(DateTimeOffset now) : TimeProvider
{
    public DateTimeOffset UtcNow { get; set; } = now;

    public override DateTimeOffset GetUtcNow() => UtcNow;
}
