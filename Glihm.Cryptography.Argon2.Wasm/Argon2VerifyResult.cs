using Microsoft.JSInterop;

namespace Glihm.Cryptography.Argon2.Wasm;

/// <summary>
/// Argon2 verify result from interop.
/// </summary>
public class Argon2VerifyResult
{
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
    public Argon2VerifyResult()
    {
        this.Argon2ErrorMsg = string.Empty;
    }

    /// <inheritdoc/>
    public override string ToString()
    {
        return $"Argon2VerifyResult: {this.Argon2Code} ({this.Argon2ErrorMsg})\n" +
            $"{this.Error}";
    }
}
