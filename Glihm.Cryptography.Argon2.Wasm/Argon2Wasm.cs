using Microsoft.JSInterop;

namespace Glihm.Cryptography.Argon2.Wasm;

/// <summary>
/// Argon2 interop with javascript managing the wasm module.
/// </summary>
public class Argon2Wasm : IAsyncDisposable
{
    /// <summary>
    /// Argon2 module task.
    /// </summary>
    private readonly Lazy<Task<IJSObjectReference>> argon2ModuleTask;

    /// <summary>
    /// Linear memory module task.
    /// </summary>
    private readonly Lazy<Task<IJSObjectReference>> linearMemoryModuleTask;

    /// <summary>
    /// Ctor.
    /// </summary>
    /// <param name="jsRuntime"></param>
    public Argon2Wasm(IJSRuntime jsRuntime)
    {
        this.argon2ModuleTask = new(() => jsRuntime.InvokeAsync<IJSObjectReference>(
            "import", "./_content/Glihm.Cryptography.Argon2.Wasm/argon2.js").AsTask());

        this.linearMemoryModuleTask = new(() => jsRuntime.InvokeAsync<IJSObjectReference>(
            "import", "./_content/Glihm.Cryptography.Argon2.Wasm/linearMemory.js").AsTask());
    }

    /// <summary>
    /// Hashes the given password with salt and parameters.
    /// </summary>
    /// <param name="password">Password to hash.</param>
    /// <param name="salt">Salt associated during the hash computation.</param>
    /// <param name="argon2Params">Argon2 parameters.</param>
    /// <param name="secret">Secret.</param>
    /// <param name="associatedData">Associated data.</param>
    /// <returns>Argon2HashResult.</returns>
    public async ValueTask<Argon2HashResult>
    Hash(string password, string salt, Argon2Parameters argon2Params,
        string? secret = null, string? associatedData = null)
    {
        IJSObjectReference argon2Module = await this.argon2ModuleTask.Value;
        _ = await this.linearMemoryModuleTask.Value;

        return await argon2Module.InvokeAsync<Argon2HashResult>(
            "hash",
            password,
            salt,
            secret,
            associatedData,
            argon2Params);
    }

    /// <summary>
    /// Hashes the given password with salt buffer and parameters.
    /// </summary>
    /// <param name="password">Password to hash.</param>
    /// <param name="salt">Salt associated during the hash computation.</param>
    /// <param name="argon2Params">Argon2 parameters.</param>
    /// <param name="secret">Secret.</param>
    /// <param name="associatedData">Associated data.</param>
    /// <returns>Argon2HashResult.</returns>
    public async ValueTask<Argon2HashResult>
    Hash(byte[] password, byte[] salt, Argon2Parameters argon2Params,
        byte[]? secret = null, byte[]? associatedData = null)
    {
        IJSObjectReference argon2Module = await this.argon2ModuleTask.Value;
        _ = await this.linearMemoryModuleTask.Value;

        return await argon2Module.InvokeAsync<Argon2HashResult>(
            "hash",
            password,
            salt,
            secret,
            associatedData,
            argon2Params);
    }

    /// <summary>
    /// Verifies the given password against the given hash.
    /// </summary>
    /// <param name="encodedHash">Encoded hash parameters.</param>
    /// <param name="password">Password to verify.</param>
    /// <param name="type">Argon2 type.</param>
    /// <param name="secret">Secret.</param>
    /// <param name="associatedData">Associated data.</param>
    /// <returns>Argon2VerifyResult.</returns>
    public async ValueTask<Argon2VerifyResult>
    Verify(string encodedHash, string password, Argon2Type type,
           string? secret = null, string? associatedData = null)
    {
        IJSObjectReference argon2Module = await this.argon2ModuleTask.Value;
        _ = await this.linearMemoryModuleTask.Value;

        return await argon2Module.InvokeAsync<Argon2VerifyResult>(
            "verify",
            encodedHash,
            password,
            secret,
            associatedData,
            type);
    }

    /// <summary>
    /// Verifies the given buffer password against the given hash.
    /// </summary>
    /// <param name="encodedHash">Encoded hash parameters.</param>
    /// <param name="password">Password to verify.</param>
    /// <param name="type">Argon2 type.</param>
    /// <param name="secret">Secret.</param>
    /// <param name="associatedData">Associated data.</param>
    /// <returns>Argon2VerifyResult.</returns>
    public async ValueTask<Argon2VerifyResult>
    Verify(string encodedHash, byte[] password, Argon2Type type,
           byte[]? secret = null, byte[]? associatedData = null)
    {
        IJSObjectReference argon2Module = await this.argon2ModuleTask.Value;
        _ = await this.linearMemoryModuleTask.Value;

        return await argon2Module.InvokeAsync<Argon2VerifyResult>(
            "verify",
            encodedHash,
            password,
            secret,
            associatedData,
            type);
    }

    /// <summary>
    /// Cleanup allocated resources.
    /// </summary>
    /// <returns></returns>
    public async ValueTask
    DisposeAsync()
    {
        if (this.argon2ModuleTask.IsValueCreated)
        {
            var module = await this.argon2ModuleTask.Value;
            await module.DisposeAsync();
        }

        if (this.linearMemoryModuleTask.IsValueCreated)
        {
            var module = await this.linearMemoryModuleTask.Value;
            await module.DisposeAsync();
        }
    }
}