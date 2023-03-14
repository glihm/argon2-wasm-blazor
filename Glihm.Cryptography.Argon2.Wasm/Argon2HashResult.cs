using Microsoft.JSInterop;

namespace Glihm.Cryptography.Argon2.Wasm;

/// <summary>
/// Argon2 hash result from interop.
/// </summary>
public class Argon2HashResult
{
    /// <summary>
    /// Hash raw.
    /// </summary>
    public byte[] Hash { get; set; }

    /// <summary>
    /// Encoded hash.
    /// </summary>
    public string EncodedHash { get; set; }

    /// <summary>
    /// Javascript error.
    /// </summary>
    public JSException? Error { get; set; }

    /// <summary>
    /// Argon2 return code from C code.
    /// </summary>
    public int Argon2Code { get; set; }

    /// <summary>
    /// Argon2 error message.
    /// </summary>
    public string Argon2ErrorMsg { get; set; }

    /// <summary>
    /// Ctor.
    /// </summary>
    public Argon2HashResult()
    {
        this.Hash = Array.Empty<byte>();
        this.EncodedHash = string.Empty;
        this.Argon2ErrorMsg = string.Empty;
    }

    /// <inheritdoc/>
    public override string
    ToString()
    {
        return $"Argon2HashResult: {this.Argon2Code} ({this.Argon2ErrorMsg})\n" +
            $"{this.EncodedHash} [{BitConverter.ToString(this.Hash)}]\n" +
            $"{this.Error}\n";
    }
}
