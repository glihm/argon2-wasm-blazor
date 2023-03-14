namespace Glihm.Cryptography.Argon2.Wasm;

/// <summary>
/// Argon2 parameters used to hash a password.
/// </summary>
public class Argon2Parameters
{
    /// <summary>
    /// Number of iterations.
    /// </summary>
    public int Iterations { get; set; }

    /// <summary>
    /// Memory cost in KiB.
    /// </summary>
    public int Memory { get; set; }

    /// <summary>
    /// Number of threads and compute lane.
    /// </summary>
    public int Parallelism { get; set; }

    /// <summary>
    /// Desired length of the hash in bytes.
    /// </summary>
    public int HashLength { get; set; }

    /// <summary>
    /// Argon2 primitive type.
    /// </summary>
    public Argon2Type Type { get; set; }
}
