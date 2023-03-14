/*
 * Argon2 extension of hash and verify signatures to support all inputs.
 *
 * The current reference implementation is not including secret and additional data.
 * Those inputs are included in the hashing process and then affect the result tag.
 * For this reason, having those inputs allow a full coverage of the Argon2 use.
 *
 * The two functions of this file were copied from `argon2.c` from argon2 reference
 * C implementation, and the modifications are surrounded by comments to clearly identify them.
 *
 * Copyright 2023 Pierre BERTIN.
 *
 * You may use this work under the terms of a MIT license, at your option.
 * Please refer to the LICENSE file at the root of this repository.
 */

#include <string.h>
#include <stdlib.h>
#include <stdio.h>

#include "argon2.h"
#include "encoding.h"
#include "core.h"

int argon2_hash_full(const uint32_t t_cost, const uint32_t m_cost,
                     const uint32_t parallelism, const void *pwd,
                     const size_t pwdlen, const void *salt, const size_t saltlen,
                     /* argon2-blazor-wasm modification starts. */
                     const void *secret, const size_t secretlen,
                     const void *ad, const size_t adlen,
                     /* argon2-blazor-wasm modification ends. */
                     void *hash, const size_t hashlen, char *encoded,
                     const size_t encodedlen, argon2_type type,
                     const uint32_t version){

    argon2_context context;
    int result;
    uint8_t *out;

    if (pwdlen > ARGON2_MAX_PWD_LENGTH) {
        return ARGON2_PWD_TOO_LONG;
    }

    if (saltlen > ARGON2_MAX_SALT_LENGTH) {
        return ARGON2_SALT_TOO_LONG;
    }

    if (hashlen > ARGON2_MAX_OUTLEN) {
        return ARGON2_OUTPUT_TOO_LONG;
    }

    if (hashlen < ARGON2_MIN_OUTLEN) {
        return ARGON2_OUTPUT_TOO_SHORT;
    }

    out = malloc(hashlen);
    if (!out) {
        return ARGON2_MEMORY_ALLOCATION_ERROR;
    }

    context.out = (uint8_t *)out;
    context.outlen = (uint32_t)hashlen;
    context.pwd = CONST_CAST(uint8_t *)pwd;
    context.pwdlen = (uint32_t)pwdlen;
    context.salt = CONST_CAST(uint8_t *)salt;
    context.saltlen = (uint32_t)saltlen;
    /* argon2-blazor-wasm modification starts. */
    context.secret = CONST_CAST(uint8_t *)secret;
    context.secretlen = (uint32_t)secretlen;
    context.ad = CONST_CAST(uint8_t *)ad;
    context.adlen = (uint32_t)adlen;
    /* argon2-blazor-wasm modification end. */
    context.t_cost = t_cost;
    context.m_cost = m_cost;
    context.lanes = parallelism;
    context.threads = parallelism;
    context.allocate_cbk = NULL;
    context.free_cbk = NULL;
    context.flags = ARGON2_DEFAULT_FLAGS;
    context.version = version;

    result = argon2_ctx(&context, type);

    if (result != ARGON2_OK) {
        clear_internal_memory(out, hashlen);
        free(out);
        return result;
    }

    /* if raw hash requested, write it */
    if (hash) {
        memcpy(hash, out, hashlen);
    }

    /* if encoding requested, write it */
    if (encoded && encodedlen) {
        if (encode_string(encoded, encodedlen, &context, type) != ARGON2_OK) {
            clear_internal_memory(out, hashlen); /* wipe buffers if error */
            clear_internal_memory(encoded, encodedlen);
            free(out);
            return ARGON2_ENCODING_FAIL;
        }
    }
    clear_internal_memory(out, hashlen);
    free(out);

    return ARGON2_OK;
}

int argon2_verify_full(const char *encoded, const void *pwd, const size_t pwdlen,
                       /* argon2-blazor-wasm modification starts. */
                       const void *secret, const size_t secretlen,
                       const void *ad, const size_t adlen,
                       /* argon2-blazor-wasm modification end. */
                       argon2_type type) {

    argon2_context ctx;
    uint8_t *desired_result = NULL;

    int ret = ARGON2_OK;

    size_t encoded_len;
    uint32_t max_field_len;

    if (pwdlen > ARGON2_MAX_PWD_LENGTH) {
        return ARGON2_PWD_TOO_LONG;
    }

    if (encoded == NULL) {
        return ARGON2_DECODING_FAIL;
    }

    encoded_len = strlen(encoded);
    if (encoded_len > UINT32_MAX) {
        return ARGON2_DECODING_FAIL;
    }

    /* No field can be longer than the encoded length */
    max_field_len = (uint32_t)encoded_len;

    ctx.saltlen = max_field_len;
    ctx.outlen = max_field_len;

    ctx.salt = malloc(ctx.saltlen);
    ctx.out = malloc(ctx.outlen);
    if (!ctx.salt || !ctx.out) {
        ret = ARGON2_MEMORY_ALLOCATION_ERROR;
        goto fail;
    }

    ctx.pwd = (uint8_t *)pwd;
    ctx.pwdlen = (uint32_t)pwdlen;

    ret = decode_string(&ctx, encoded, type);
    if (ret != ARGON2_OK) {
        goto fail;
    }

    /* Set aside the desired result, and get a new buffer. */
    desired_result = ctx.out;
    ctx.out = malloc(ctx.outlen);
    if (!ctx.out) {
        ret = ARGON2_MEMORY_ALLOCATION_ERROR;
        goto fail;
    }

    /* argon2-blazor-wasm modification starts. */
    ctx.secret = CONST_CAST(uint8_t *)secret;
    ctx.secretlen = (uint32_t)secretlen;
    ctx.ad = CONST_CAST(uint8_t *)ad;
    ctx.adlen = (uint32_t)adlen;
    /* argon2-blazor-wasm modification ends. */

    ret = argon2_verify_ctx(&ctx, (char *)desired_result, type);
    if (ret != ARGON2_OK) {
        goto fail;
    }

fail:
    free(ctx.salt);
    free(ctx.out);
    free(desired_result);

    return ret;
}
