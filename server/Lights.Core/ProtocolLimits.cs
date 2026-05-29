namespace Lights.Core;

/// <summary>
/// Authoritative limits and the <see cref="Sanitize"/> routine for incoming
/// <see cref="LightState"/>. Mirrors <c>LIMITS</c>/<c>sanitizeLightState</c> in the
/// TypeScript protocol package; both sides apply identical clamping.
/// </summary>
public static class ProtocolLimits
{
    public const int ProtocolVersion = 2;

    public const int ColorMin = 0;
    public const int ColorMax = 255;
    public const double BrightnessMin = 0.0;
    public const double BrightnessMax = 1.0;
    public const double RadiusMin = 0.0;
    public const double RadiusMax = 1.0;
    public const double PositionMin = 0.0;
    public const double PositionMax = 1.0;
    public const double WavelengthMin = 380.0;
    public const double WavelengthMax = 780.0;
    public const double FlickerHzMin = 0.0;

    // v2 stimulus-depth ranges.
    public const double ApertureMin = 0.0;
    public const double ApertureMax = 1.0;
    public const double EyeDistanceMin = -1.0;
    public const double EyeDistanceMax = 1.0;
    public const double RotationDegMin = 0.0;
    public const double RotationDegMax = 360.0;

    /// <summary>13-bit clock-grid mask (bit 0 = center, 1..12 = clock hours).</summary>
    public const int EyePositionsMask = 0x1fff;

    /// <summary>A/B background alternation rate; same ceiling + consent gate as flicker.</summary>
    public const double AbHzMin = 0.0;
    public const double AbHzMax = 60.0;

    /// <summary>KITT sweep oscillation rate — slow scanner motion, not a strobe.</summary>
    public const double SweepHzMin = 0.0;
    public const double SweepHzMax = 5.0;

    /// <summary>KITT sweep amplitude, normalised fraction of the viewport.</summary>
    public const double SweepRangeMin = 0.0;
    public const double SweepRangeMax = 1.0;

    private static readonly string[] RenderModes = { "mono", "vergence", "align", "paired", "manual" };

    /// <summary>
    /// Hard ceiling for flicker. A consent gate is still required on the client
    /// before any flicker &gt; 0 is rendered.
    /// </summary>
    public const double FlickerHzMax = 60.0;

    /// <summary>Highest photosensitive-seizure-risk band (informational).</summary>
    public const double FlickerHighRiskMinHz = 15.0;
    public const double FlickerHighRiskMaxHz = 25.0;

    public static int Clamp(int value, int lo, int hi) => Math.Min(hi, Math.Max(lo, value));

    public static double Clamp(double value, double lo, double hi) =>
        double.IsFinite(value) ? Math.Min(hi, Math.Max(lo, value)) : lo;

    private static string SanitizeMode(string? mode) =>
        Array.IndexOf(RenderModes, mode) >= 0 ? mode! : "mono";

    private static EyeField? SanitizeEye(EyeField? e) =>
        e is null
            ? null
            : new EyeField
            {
                Positions = Clamp(e.Positions, 0, EyePositionsMask) & EyePositionsMask,
                RotationDeg = Clamp(e.RotationDeg, RotationDegMin, RotationDegMax),
            };

    private static AbBackground? SanitizeBackground(AbBackground? b)
    {
        if (b is null) return null;
        var c = b.Color ?? new Rgb { R = 0, G = 0, B = 0 };
        return new AbBackground
        {
            Color = new Rgb
            {
                R = Clamp(c.R, ColorMin, ColorMax),
                G = Clamp(c.G, ColorMin, ColorMax),
                B = Clamp(c.B, ColorMin, ColorMax),
            },
            Hz = Clamp(b.Hz, AbHzMin, AbHzMax),
        };
    }

    private static Sweep? SanitizeSweep(Sweep? s) =>
        s is null
            ? null
            : new Sweep
            {
                Hz = Clamp(s.Hz, SweepHzMin, SweepHzMax),
                Axis = s.Axis == "y" ? "y" : "x",
                Range = Clamp(s.Range, SweepRangeMin, SweepRangeMax),
            };

    /// <summary>Clamp/normalise an incoming state so renderers can trust it.</summary>
    public static LightState Sanitize(LightState? input)
    {
        var s = input ?? new LightState();
        var color = s.Color ?? new Rgb { R = 255, G = 0, B = 0 };
        var shape = s.Shape ?? new Shape();

        return new LightState
        {
            V = ProtocolVersion,
            Color = new Rgb
            {
                R = Clamp(color.R, ColorMin, ColorMax),
                G = Clamp(color.G, ColorMin, ColorMax),
                B = Clamp(color.B, ColorMin, ColorMax),
            },
            Source = s.Source == "wavelength" ? "wavelength" : "rgb",
            WavelengthNm = s.WavelengthNm is null
                ? null
                : Clamp(s.WavelengthNm.Value, WavelengthMin, WavelengthMax),
            Brightness = Clamp(s.Brightness, BrightnessMin, BrightnessMax),
            Shape = new Shape
            {
                X = Clamp(shape.X, PositionMin, PositionMax),
                Y = Clamp(shape.Y, PositionMin, PositionMax),
                Radius = Clamp(shape.Radius, RadiusMin, RadiusMax),
            },
            FlickerHz = Clamp(s.FlickerHz, FlickerHzMin, FlickerHzMax),
            Ts = s.Ts,
            Mode = SanitizeMode(s.Mode),
            Left = SanitizeEye(s.Left),
            Right = SanitizeEye(s.Right),
            Aperture = s.Aperture is null ? null : Clamp(s.Aperture.Value, ApertureMin, ApertureMax),
            EyeDistance = s.EyeDistance is null
                ? null
                : Clamp(s.EyeDistance.Value, EyeDistanceMin, EyeDistanceMax),
            Background = SanitizeBackground(s.Background),
            Sweep = SanitizeSweep(s.Sweep),
        };
    }
}
