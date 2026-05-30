using Lumessa.Core;
using Xunit;

namespace Lumessa.Core.Tests;

public class SessionStoreTests
{
    [Fact]
    public void Create_ProducesCodeOfExpectedShape()
    {
        var store = new InMemorySessionStore();
        var session = store.Create(TimeSpan.FromHours(1));

        Assert.Equal(SessionCode.Length, session.Code.Length);
        Assert.All(session.Code, ch => Assert.Contains(ch, SessionCode.Alphabet));
        Assert.NotEqual(session.Id, session.Code);
    }

    [Fact]
    public void GetByCode_IsCaseInsensitiveAndNormalized()
    {
        var store = new InMemorySessionStore();
        var session = store.Create(TimeSpan.FromHours(1));

        Assert.NotNull(store.GetByCode(session.Code.ToLowerInvariant()));
        Assert.NotNull(store.GetByCode($"  {session.Code}  "));
        Assert.Null(store.GetByCode("######"));
        Assert.Null(store.GetByCode(""));
    }

    [Theory]
    [InlineData("o", "0")]
    [InlineData("I", "1")]
    [InlineData("l", "1")]
    [InlineData("U", "V")]
    [InlineData(" k3f9 ", "K3F9")]
    public void Normalize_MapsConfusablesAndUppercases(string input, string expected)
    {
        Assert.Equal(expected, SessionCode.Normalize(input));
    }

    [Fact]
    public void ExpiredSessions_AreNotReturnedAndCanBePurged()
    {
        var t0 = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var clock = new TestClock(t0);
        var store = new InMemorySessionStore(clock);

        var session = store.Create(TimeSpan.FromHours(1));
        Assert.NotNull(store.Get(session.Id));

        clock.UtcNow = t0.AddHours(2);

        Assert.Null(store.Get(session.Id));
        Assert.Null(store.GetByCode(session.Code));
        Assert.Equal(1, store.PurgeExpired());
    }

    [Fact]
    public void Remove_DropsSessionAndCode()
    {
        var store = new InMemorySessionStore();
        var session = store.Create(TimeSpan.FromHours(1));

        store.Remove(session.Id);

        Assert.Null(store.Get(session.Id));
        Assert.Null(store.GetByCode(session.Code));
    }
}
