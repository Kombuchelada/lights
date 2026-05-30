namespace Lumessa.Core;

/// <summary>
/// Visible-light wavelength (nm) → approximate sRGB, using the Bruton/Noah
/// algorithm. Kept in sync with <c>wavelengthToRgb</c> in the TypeScript
/// protocol package.
/// </summary>
public static class Wavelength
{
    public static Rgb ToRgb(double wavelength)
    {
        var nm = ProtocolLimits.Clamp(wavelength, ProtocolLimits.WavelengthMin, ProtocolLimits.WavelengthMax);
        const double gamma = 0.8;
        const double max = 255.0;
        double r = 0, g = 0, b = 0;

        if (nm < 440) { r = -(nm - 440) / (440 - 380); b = 1; }
        else if (nm < 490) { g = (nm - 440) / (490 - 440); b = 1; }
        else if (nm < 510) { g = 1; b = -(nm - 510) / (510 - 490); }
        else if (nm < 580) { r = (nm - 510) / (580 - 510); g = 1; }
        else if (nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); }
        else { r = -(nm - 781) / (781 - 645); }

        // Intensity falls off near the limits of human vision.
        double factor = 1.0;
        if (nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
        else if (nm >= 701) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);

        return new Rgb { R = Channel(r), G = Channel(g), B = Channel(b) };

        int Channel(double c) => c <= 0 ? 0 : (int)Math.Round(max * Math.Pow(c * factor, gamma));
    }
}
