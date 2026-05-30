using System.Security.Cryptography;
using System.Text;

namespace Lumessa.Core;

/// <summary>
/// Session pairing codes: Crockford base32 (no I/L/O/U), fixed length. Generated
/// with a cryptographic RNG; matched case-insensitively with common-confusion
/// mapping on input.
/// </summary>
public static class SessionCode
{
    public const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    public const int Length = 6;

    public static string Generate()
    {
        var chars = new char[Length];
        for (var i = 0; i < Length; i++)
        {
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }
        return new string(chars);
    }

    /// <summary>
    /// Normalise user-entered codes: trim, uppercase, map I/L→1, O→0, U→V, and
    /// drop anything outside the alphabet.
    /// </summary>
    public static string Normalize(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return string.Empty;

        var upper = code.Trim().ToUpperInvariant();
        var sb = new StringBuilder(upper.Length);
        foreach (var raw in upper)
        {
            var ch = raw switch
            {
                'I' or 'L' => '1',
                'O' => '0',
                'U' => 'V',
                _ => raw,
            };
            if (Alphabet.IndexOf(ch) >= 0) sb.Append(ch);
        }
        return sb.ToString();
    }
}
