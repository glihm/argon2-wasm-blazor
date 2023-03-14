/*
 * Argon2 interop code to interact with Wasm module.
 */

"use strict";

import { LinearMemory, LinearMemoryHandle } from "./linearMemory.js";

/**
 * Converts the given amout of memory
 * into a number of Wasm page(s) (64KiB).
 * 
 * @param {number} mem - Memory required, unit depends on the other parameter.
 * @param {string} unit - Memory unit in *bibyte (K, M, or G), default to K.
 * @returns {number} - Number of page(s).
 */
function wasmPagesFromBiByte(mem, unit = "K")
{
    const KiB = 1024;
    const MiB = 1024 * KiB;
    const GiB = 1024 * MiB;
    const WASM_PAGE_SIZE = 64 * KiB;

    const memFactor =
    {
        "K": KiB,
        "M": MiB,
        "G": GiB
    };

    const memAmount = mem * memFactor[unit];
    if (memAmount < WASM_PAGE_SIZE)
    {
        throw new Error(`Memory for Wasm module must be at least ${WASM_PAGE_SIZE} bytes.`)
    }

    return Math.ceil(memAmount / WASM_PAGE_SIZE);
}

/**
 * Extracts the memory cost in KiB from the encoded hash string.
 * 
 * @param {string} encodedHash - Encoded argon2 hash.
 * @returns {number} - Number of KiB to use as memory cost on success, 0 otherwise.
 */
function argon2MemoryCostFromEncodedHash(encodedHash)
{
    const costStr = encodedHash.split("m=")[1].split(",")[0];
    const kib = parseInt(costStr);

    return isNaN(kib) ? 0 : kib;
}

/**
 * Argon2 module and linear memory, used for internal purpose only
 * as a convenient way to get access to the module exports and linear memory.
 * 
 * @typedef {Object} Argon2InternalModule
 * @property {Module} module - Wasm module for argon2.
 * @property {LinearMemory} linearMemory - Linear memory of the instantiated module.
 */

/**
 * Instanciates the Argon2 Wasm module with the given memory size.
 * As by design Argon2 has a parameter indicating the amount of memory to be used (in KiB),
 * this amount of memory is considered for the wasm module + the size of the Wasm module file itself,
 * as it's also included in the same linear memory.
 * 
 * For convenience in this implementation as the size of the wasm file is known in advance,
 * we take some extra KiB just in case.
 * 
 * @param {number} memKiBCost - Memory cost for Argon2, in KiB.
 * @returns {Argon2InternalModule} - Internal module with argon2 wasm module and associated linear memory.
 */
async function _instantiate(memKiBCost)
{
    // 32 KiB, some extra KiB based on the size of the wwwroot/argon2.wasm file.
    const argon2WasmFileKiB = 64;

    const importObj =
    {
        env:
        {
            memory: new WebAssembly.Memory(
            {
                initial: wasmPagesFromBiByte(argon2WasmFileKiB + memKiBCost)
            }),
        },
        wasi_snapshot_preview1:
        {
            // TODO: For now it's here.. but I need to find how to strip
            // those symbols during clang compilation and wasm-ld linkage as they are not used at all.
            fd_close: function () { },
            fd_seek: function () { },
            fd_write: function () { },
        }
    };

    try
    {
        // TODO: check what can be the best practice to cache this file... but also check the security...
        const wasmUrl = "./_content/Glihm.Cryptography.Argon2.Wasm/argon2.wasm";
        const module = await WebAssembly.instantiateStreaming(fetch(wasmUrl), importObj)
        const exports = module.instance.exports;

        const ret =
        {
            module: module,
            linearMemory: new LinearMemory(importObj.env.memory, exports.malloc, exports.free),
        }

        return ret;
    }
    catch (e)
    {
        console.error(e);
        return null;
    }
}

/**
 * Argon2 verify result.
 * @typedef {Object} Argon2VerifyResult
 * @property {error} error - An error thrown.
 * @property {number} argon2Code - Argon2 returned code.
 * @property {string} argon2ErrorMsg - Argon2 reason string attached to error code.
 */

/**
 * Verifies Argon2 hash.
 * 
 * @param {string} encodedHash - Argon2 encoded hash (ex: $argon2i$v=19$m=65536,t=2,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG)
 * @param {string|Uint8Array} password - Password to be verified.
 * @param {Uint8Array|string|null} secret - Secret value (optional).
 * @param {Uint8Array|string|null} associatedData - Associated data (optional).
 * @param {Argon2Type} argon2Type - Argon2Type.
 * @returns {Argon2VerifyResult} Argon2 verify result.
 */
export async function verify(encodedHash, password, secret, associatedData, argon2Type)
{
    let res = {};

    const memCostKiB = argon2MemoryCostFromEncodedHash(encodedHash);
    if (memCostKiB === 0)
    {
        res.error = new Error("Could not extract memory cost from encoded hash.");
        return res;
    }

    const argon2 = await _instantiate(memCostKiB);
    if (!argon2)
    {
        res.error = new Error("Could not instantiate Argon2 Wasm module.");
        return res;
    }

    const argon2Funcs = argon2.module.instance.exports;
    const argon2Lm = argon2.linearMemory;

    // Needs to be null terminated as C api is expecting `const char *`.
    const encodedH = argon2Lm.storeStr(encodedHash);

    // Don't need the null terminated as C api is expecting `void *` and length.
    const pwdH = typeof password === "string" ?
        argon2Lm.storeStr(password, false) :
        argon2Lm.storeArray(password);

    // If strings, not null terminated as C is expected `const void *`.
    const secretH = typeof secret === "string" ?
        argon2Lm.storeStr(secret, false) :
        argon2Lm.storeArray(secret);

    const adH = typeof associatedData === "string" ?
        argon2Lm.storeStr(associatedData, false) :
        argon2Lm.storeArray(associatedData);

    try
    {
        res.argon2Code = argon2Funcs.argon2_verify_full(
            encodedH.addr,
            pwdH.addr,
            pwdH.length,
            secretH.addr,
            secretH.length,
            adH.addr,
            adH.length,
            argon2Type
        );
    }
    catch (e)
    {
        res.error = e;
        return res;
    }

    if (!res.error)
    {
        const msgH = new LinearMemoryHandle(argon2Funcs.argon2_error_message(res.argon2Code));
        msgH.length = argon2Funcs.strlen(msgH.addr);
        res.argon2ErrorMsg = argon2Lm.loadStr(msgH);
    }

    try
    {
        argon2Funcs.free(pwdH.addr);
        argon2Funcs.free(encodedH.addr);
    }
    catch (e)
    {
        res.error = e;
    }

    return res;
}

/**
 * Argon2 parameters to compute hash.
 * 
 * @typedef {Object} Argon2Params
 * @property {number} iterations - Number of iterations.
 * @property {number} memory - Sets memory usage to m_cost kibibytes.
 * @property {number} parallelism - Number of threads and compute lane.
 * @property {number} hashLength - Desired length of the hash in bytes.
 * @property {number} type - Argon2 primitive type.
 */

/**
 * Argon2 hash result.
 * @typedef {Object} Argon2HashResult
 * @property {Uint8Array} hash - Hash raw buffer.
 * @property {string} encodedHash - Encoded hash.
 * @property {error} error - An error thrown.
 * @property {number} argon2Code - Argon2 error code.
 * @property {string} argon2ErrorMsg - Argon2 reason string attached to error code.
 */

/**
 * Computes Argon2 hash.
 * @param {string|Uint8Array} password - Password to hash.
 * @param {string|Uint8Array} salt - Salt to use.
 * @param {Uint8Array|string|null} secret - Secret value (optional).
 * @param {Uint8Array|string|null} associatedData - Associated data (optional).
 * @param {Argon2Params} params - Argon2 parameters.
 * @returns {Argon2HashResult} Argon2 hash result.
 */
export async function hash(password, salt, secret, associatedData, params)
{
    let res = {};

    const argon2 = await _instantiate(params.memory);
    if (!argon2)
    {
        res.error = new Error("Could not instantiate Argon2 Wasm module.");
        return res;
    }

    const argon2Funcs = argon2.module.instance.exports;
    const argon2Lm = argon2.linearMemory;

    const t_cost = params.iterations;
    const m_cost = params.memory;
    const parallelism = params.parallelism;
    const type = params.type;
    const hashLen = params.hashLength;

    // If strings, not null terminated as C is expected `const void *`.
    const saltH = typeof salt === "string" ?
        argon2Lm.storeStr(salt, false) :
        argon2Lm.storeArray(salt);

    const pwdH = typeof password === "string" ?
        argon2Lm.storeStr(password, false) :
        argon2Lm.storeArray(password);

    // Pre-compute hash len to allocate the output array.
    const encodedHashlen = argon2Funcs.argon2_encodedlen(
        t_cost,
        m_cost,
        parallelism,
        saltH.length,
        hashLen,
        type
    );

    // "allocates" the arrays for output results.
    const encodedH = argon2Lm.alloc(encodedHashlen);
    const hashH = argon2Lm.alloc(hashLen);

    // If strings, not null terminated as C is expected `const void *`.
    const secretH = typeof secret === "string" ?
        argon2Lm.storeStr(secret, false) :
        argon2Lm.storeArray(secret);

    const adH = typeof associatedData === "string" ?
        argon2Lm.storeStr(associatedData, false) :
        argon2Lm.storeArray(associatedData);

    const version = 0x13;

    try
    {
        res.argon2Code = argon2Funcs.argon2_hash_full(
            t_cost,
            m_cost,
            parallelism,
            pwdH.addr,
            pwdH.length,
            saltH.addr,
            saltH.length,
            secretH.addr,
            secretH.length,
            adH.addr,
            adH.length,
            hashH.addr,
            hashLen,
            encodedH.addr,
            encodedHashlen,
            type,
            version
        );
    }
    catch (e)
    {
        res.error = e;
        console.error(res);
        return res;
    }

    if (!res.error)
    {
        const msgH = new LinearMemoryHandle(argon2Funcs.argon2_error_message(res.argon2Code));
        msgH.length = argon2Funcs.strlen(msgH.addr);
        res.argon2ErrorMsg = argon2Lm.loadStr(msgH);

        if (res.argon2Code === 0)
        {
            res.hash = argon2Lm.loadArray(hashH);

            // To ensure C# compatibility, the null terminated character must be removed.
            // If not removed, C# string will have this invisible chars at the end.
            // TODO: check if here is the best place to do that. In C# it does not look natural
            //       to remove it. And this code is aware that it is dealing with C wasm compiled program.
            encodedH.length -= 1;
            res.encodedHash = argon2Lm.loadStr(encodedH);
        }
    }

    try
    {
        argon2Funcs.free(pwdH.addr);
        argon2Funcs.free(saltH.addr);
        argon2Funcs.free(hashH.addr);
        argon2Funcs.free(encodedH.addr);
    }
    catch (e)
    {
        res.error = e;
    }

    return res;
}
