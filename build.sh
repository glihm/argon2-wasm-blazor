
clang -v -Wall -O3 \
      --target=wasm32-unknown-wasi \
      --sysroot /tmp/wasi-libc \
      -nostartfiles \
      -Wl,--import-memory \
      -Wl,--no-entry \
      -Wl,--export=argon2_hash_full \
      -Wl,--export=argon2_verify_full \
      -Wl,--export=argon2_encodedlen \
      -Wl,--export=argon2_error_message \
      -Wl,--export=malloc \
      -Wl,--export=free \
      -Wl,--export=strlen \
      -Wl,-O3 \
      -Wl,--no-demangle \
      -rtlib=compiler-rt \
      -o ./Glihm.Cryptography.Argon2.Wasm/wwwroot/argon2.wasm \
      ./argon2/src/blake2/blake2b.c \
      ./argon2/src/argon2.c \
      ./argon2/src/core.c \
      ./argon2/src/encoding.c \
      ./argon2/src/ref.c \
      ./src/argon2_full.c \
      -I ./argon2/include/ \
      -I ./argon2/src/ \
      -D ARGON2_NO_THREADS

