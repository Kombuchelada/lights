namespace Lights.Core;

/// <summary>sRGB color channels, each 0–255.</summary>
public sealed record Rgb
{
    public int R { get; init; }
    public int G { get; init; }
    public int B { get; init; }
}

/// <summary>
/// Position + size of the light, normalised to the viewport (0..1) so it renders
/// identically on any screen resolution. <c>Radius</c> is a fraction of half the
/// shorter viewport side.
/// </summary>
public sealed record Shape
{
    public double X { get; init; } = 0.5;
    public double Y { get; init; } = 0.5;
    public double Radius { get; init; } = 0.35;
}

/// <summary>
/// Per-eye targeting on the fixed 13-cell clock grid.
/// <c>Positions</c> is a 13-bit mask: bit 0 = center, bits 1..12 = clock-hour
/// positions on a ring. <c>RotationDeg</c> rotates that ring pattern.
/// </summary>
public sealed record EyeField
{
    /// <summary>13-bit mask of lit grid cells (0..8191).</summary>
    public int Positions { get; init; }

    /// <summary>Rotation of the ring pattern, degrees (0..360).</summary>
    public double RotationDeg { get; init; }
}

/// <summary>
/// A/B alternating background. <c>Hz</c> = 0 paints a steady
/// color; &gt; 0 alternates between black and <c>Color</c> (a full-screen flash,
/// gated behind the client's photosensitivity consent like flicker).
/// </summary>
public sealed record AbBackground
{
    public Rgb Color { get; init; } = new() { R = 0, G = 0, B = 0 };
    public double Hz { get; init; }
}

/// <summary>
/// KITT scanning sweep — an oscillating light. <c>Hz</c> = 0 is off; &gt; 0
/// oscillates the light center along <c>Axis</c> ("x" | "y") with amplitude
/// <c>Range</c> (0..1). Animated locally on the client; movement, not a flash,
/// so it honours <c>prefers-reduced-motion</c> rather than the flicker gate.
/// </summary>
public sealed record Sweep
{
    /// <summary>Oscillations per second; 0 = off.</summary>
    public double Hz { get; init; }

    /// <summary>Axis that sweeps: "x" (default) or "y".</summary>
    public string Axis { get; init; } = "x";

    /// <summary>Peak offset from the base position, 0..1 of the viewport.</summary>
    public double Range { get; init; }
}

/// <summary>
/// The complete, renderable light state — the unit of realtime sync. Mirrors the
/// TypeScript <c>LightState</c> in <c>packages/protocol</c>. See docs/protocol.md.
/// </summary>
public sealed record LightState
{
    /// <summary>Schema version; equals <see cref="ProtocolLimits.ProtocolVersion"/>.</summary>
    public int V { get; init; } = ProtocolLimits.ProtocolVersion;

    /// <summary>Resolved sRGB color that is actually rendered.</summary>
    public Rgb Color { get; init; } = new() { R = 255, G = 0, B = 0 };

    /// <summary>Which input produced <see cref="Color"/>: "rgb" or "wavelength".</summary>
    public string Source { get; init; } = "rgb";

    /// <summary>Selected wavelength in nm when <see cref="Source"/> is "wavelength".</summary>
    public double? WavelengthNm { get; init; }

    /// <summary>0..1 — rendered as the alpha of the light over pure black.</summary>
    public double Brightness { get; init; } = 0.5;

    /// <summary>Normalised position + size.</summary>
    public Shape Shape { get; init; } = new();

    /// <summary>Flicker frequency in Hz; 0 = steady. Rendered locally on the client.</summary>
    public double FlickerHz { get; init; }

    /// <summary>Optional sender timestamp (epoch ms), diagnostics only.</summary>
    public long? Ts { get; init; }

    // ---- v2 (stimulus depth) — all optional; absent ⇒ mono single circle ----

    /// <summary>Render mode: "mono" (default) | "vergence" | "align" | "paired" | "manual".</summary>
    public string Mode { get; init; } = "mono";

    /// <summary>Left-eye targeting (stereo modes only).</summary>
    public EyeField? Left { get; init; }

    /// <summary>Right-eye targeting (stereo modes only).</summary>
    public EyeField? Right { get; init; }

    /// <summary>Per-dot aperture size in stereo modes (0..1).</summary>
    public double? Aperture { get; init; }

    /// <summary>Interpupillary horizontal offset of the two panes (-1..1).</summary>
    public double? EyeDistance { get; init; }

    /// <summary>A/B alternating background.</summary>
    public AbBackground? Background { get; init; }

    /// <summary>KITT oscillating sweep of the light position.</summary>
    public Sweep? Sweep { get; init; }
}
