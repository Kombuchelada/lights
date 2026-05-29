using Lights.Core;
using Xunit;

namespace Lights.Core.Tests;

public class ProtocolLimitsTests
{
    [Fact]
    public void Sanitize_NullInput_ReturnsDefaults()
    {
        var s = ProtocolLimits.Sanitize(null);

        Assert.Equal(ProtocolLimits.ProtocolVersion, s.V);
        Assert.Equal("rgb", s.Source);
        Assert.Equal(0.5, s.Brightness);
        Assert.Equal(0.5, s.Shape.X);
        Assert.Equal(0.0, s.FlickerHz);
    }

    [Fact]
    public void Sanitize_ClampsAllFieldsIntoRange()
    {
        var dirty = new LightState
        {
            V = 99,
            Color = new Rgb { R = 999, G = -5, B = 40 },
            Brightness = 5.0,
            Shape = new Shape { X = -1, Y = 2, Radius = 9 },
            FlickerHz = 1000,
            WavelengthNm = 5000,
        };

        var s = ProtocolLimits.Sanitize(dirty);

        Assert.Equal(ProtocolLimits.ProtocolVersion, s.V);
        Assert.Equal(255, s.Color.R);
        Assert.Equal(0, s.Color.G);
        Assert.Equal(40, s.Color.B);
        Assert.Equal(1.0, s.Brightness);
        Assert.Equal(0.0, s.Shape.X);
        Assert.Equal(1.0, s.Shape.Y);
        Assert.Equal(1.0, s.Shape.Radius);
        Assert.Equal(ProtocolLimits.FlickerHzMax, s.FlickerHz);
        Assert.Equal(ProtocolLimits.WavelengthMax, s.WavelengthNm);
    }

    [Fact]
    public void Sanitize_NormalizesSource()
    {
        Assert.Equal("wavelength", ProtocolLimits.Sanitize(new LightState { Source = "wavelength" }).Source);
        Assert.Equal("rgb", ProtocolLimits.Sanitize(new LightState { Source = "garbage" }).Source);
    }

    [Fact]
    public void Sanitize_NonFiniteFlicker_FallsBackToMinimum()
    {
        var s = ProtocolLimits.Sanitize(new LightState { FlickerHz = double.NaN });
        Assert.Equal(ProtocolLimits.FlickerHzMin, s.FlickerHz);
    }

    [Fact]
    public void Sanitize_V1ShapedState_DefaultsToMono()
    {
        // A state with no v2 fields (as a v1 client sends) is still valid and mono.
        var s = ProtocolLimits.Sanitize(new LightState());

        Assert.Equal("mono", s.Mode);
        Assert.Null(s.Left);
        Assert.Null(s.Right);
        Assert.Null(s.Aperture);
        Assert.Null(s.EyeDistance);
        Assert.Null(s.Background);
    }

    [Fact]
    public void Sanitize_NormalizesRenderMode()
    {
        Assert.Equal("paired", ProtocolLimits.Sanitize(new LightState { Mode = "paired" }).Mode);
        Assert.Equal("mono", ProtocolLimits.Sanitize(new LightState { Mode = "garbage" }).Mode);
    }

    [Fact]
    public void Sanitize_MasksEyePositionsTo13Bits()
    {
        var s = ProtocolLimits.Sanitize(new LightState
        {
            Left = new EyeField { Positions = 0xFFFF, RotationDeg = 999 },
        });

        Assert.Equal(0x1fff, s.Left!.Positions);
        Assert.Equal(ProtocolLimits.RotationDegMax, s.Left.RotationDeg);
    }

    [Fact]
    public void Sanitize_ClampsV2NumericFields()
    {
        var s = ProtocolLimits.Sanitize(new LightState
        {
            Aperture = 5,
            EyeDistance = -9,
            Background = new AbBackground { Color = new Rgb { R = 999, G = -1, B = 10 }, Hz = 1000 },
        });

        Assert.Equal(ProtocolLimits.ApertureMax, s.Aperture);
        Assert.Equal(ProtocolLimits.EyeDistanceMin, s.EyeDistance);
        Assert.Equal(255, s.Background!.Color.R);
        Assert.Equal(0, s.Background.Color.G);
        Assert.Equal(ProtocolLimits.AbHzMax, s.Background.Hz);
    }
}
