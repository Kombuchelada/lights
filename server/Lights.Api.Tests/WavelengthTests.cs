using Lights.Core;
using Xunit;

namespace Lights.Core.Tests;

public class WavelengthTests
{
    [Theory]
    [InlineData(460)] // blue
    [InlineData(520)] // green
    [InlineData(700)] // red
    public void ToRgb_ChannelsAlwaysInRange(double nm)
    {
        var c = Wavelength.ToRgb(nm);
        Assert.InRange(c.R, 0, 255);
        Assert.InRange(c.G, 0, 255);
        Assert.InRange(c.B, 0, 255);
    }

    [Fact]
    public void ToRgb_BlueRegion_BlueDominates()
    {
        var c = Wavelength.ToRgb(460);
        Assert.Equal(255, c.B);
        Assert.True(c.B > c.R);
        Assert.Equal(0, c.R);
    }

    [Fact]
    public void ToRgb_GreenRegion_GreenDominates()
    {
        var c = Wavelength.ToRgb(520);
        Assert.Equal(255, c.G);
        Assert.True(c.G > c.B);
        Assert.Equal(0, c.B);
    }

    [Fact]
    public void ToRgb_RedRegion_RedDominates()
    {
        var c = Wavelength.ToRgb(700);
        Assert.True(c.R > 0);
        Assert.Equal(0, c.G);
        Assert.Equal(0, c.B);
    }

    [Fact]
    public void ToRgb_ClampsOutOfRangeToBounds()
    {
        Assert.Equal(Wavelength.ToRgb(ProtocolLimits.WavelengthMin), Wavelength.ToRgb(100));
        Assert.Equal(Wavelength.ToRgb(ProtocolLimits.WavelengthMax), Wavelength.ToRgb(2000));
    }
}
