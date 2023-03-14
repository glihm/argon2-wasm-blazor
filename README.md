# Argon2 wasm for Blazor.

This repo is attempted to provide a quick and easy way to use Argon2 in Blazor.

## Motivation

As cryptography in browser is not well supported (yet) by .NET natively,
this repo proposes a very thin layer of javascript interoperability with
a wasm module compiled directly from [Argon2 PHC winner official repository](https://github.com/P-H-C/phc-winner-argon2).

Also, it is a great opportunity for me (and I hope contributors) to learn
about Web Assembly, how javascript interacts with it, and how to compile
external libraries (like Argon2) into Web Assembly using `clang` without any glue code.

## Easy and ready to use with Blazor

After installing the [package](https://www.nuget.org/packages/Glihm.Cryptography.Argon2.Wasm/) from nuget
`Glihm.Cryptography.Argon2.Wasm`, few lines are required to get it working:

```csharp
// program.cs
using Glihm.Cryptography.Argon2.Wasm;
...
builder.Services.AddSingleton<Argon2Wasm>();
...
```

```csharp
// Component.cs

@using Glihm.Cryptography.Argon2.Wasm
@inject Argon2Wasm _argon2

...

// Hash example.
private async ValueTask<string?>
Argon2Hash(string password, string salt)
{
	Argon2Parameters prs = new()
	{
		Memory = 32,
		Iterations = 1,
		Parallelism = 1,
		HashLength = 16,
		Type = Argon2Type.id
	};

	Argon2HashResult hr = await this._argon2.Hash(
		password,
		salt,
		prs);

	if (hr.Argon2Code != 0)
	{
		Console.Error.WriteLine($"Argon2 error: {hr}");
		return null;
	}
	
	return hr.EncodedHash;
}

// Verify example.
private async ValueTask<bool>
Argon2Verify(string encodedHash, string password)
{
	Argon2VerifyResult vr = await this._argon2.Verify(
		hr.EncodedHash,
		password,
		Argon2Type.id);

	return vr.Argon2Code == 0;
}
```

## Argon2 library and specificity

Argon2 library is not modified. It is a subrepository of this repository, without any modification.

In the Argon2 [specification document](https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf),
it is mentioned that a `secret` and `associated data` may be passed along with the `password` and the `salt` during hashing.
Even if the documentation stipulates that, by default, no `secret` and `associated data` are expected, it is possible
to use them as the `Argon2_Context` in the C implementation [does refer to them, but does not use them](https://github.com/P-H-C/phc-winner-argon2/blob/master/src/argon2.c#L138).

For this reason, an extension to the library can be found in the `src/argon2_full.c`, where
the changes are clearly delimited by comments, from the source code of `hash` and `verify` from argon2 library.

The changes are very minor. Also, as the default implementation does not expect `secret` and `associated data`, they
are `null` by default. You can totally use the library without worrying about them.

But if you want to use them, you can do it as follow:

```csharp
Argon2HashResult hr = await this._argon2.Hash(
	"password",
	"somesalt",
	prs,
	secret: "mysecret",
	associatedData: "mysuperdata");

// This example uses strings, but there is an overload with byte[].

Argon2VerifyResult vr = await this._argon2.Verify(
	"$argon2id$v=19$m=16,t=2,p=1$RDdpN3lvT1haWmh2elJ2bQ$uv5mjtjnWb4",
	"password",
	Argon2Type.id,
	secret: "mysecret",
	associatedData: "mysuperdata");
```

Finally, this library does not (yet) verifies all your inputs. But in the near future,
the library will do some computation before sending the parameters to the wasm module
in order to catch possible inputs errors.
In the meantime, you have in the `Argon2HashResult` and `Argon2VerifyResult` objects,
the string with the reason of the failure, coming directly from argon2 library.

To ensure those minor modifications are not altering in any way how argon2 works,
I implemented (partially for now) the [test suite](https://github.com/P-H-C/phc-winner-argon2/blob/master/src/test.c)
from argon2 repository. This is working
perfectly fine for `argon2id` tests. You can find those tests in the `TestApp`->`Pages`->`Argon2id`.

About the threads, for now this library compiles argon2 without thread support, which
does not affect it's beavior as Argon2 C implementation proposes to build it without threads.
More details in the section below.

## Argon2 from C to WASM

As mentioned earlier, I wanted to compile Argon2 directly from the source to WASM, without
glue code required to load the wasm module.

As the Web Assembly execution context is very specific, all C code can't be compiled
and work out of the box. The most common example is the `libc`. You can find more details about
this in the web, starting with the [specification](https://webassembly.github.io/spec/core/),
and reading very interesting stuff about [wasi](https://wasi.dev/) and [MDN introduction](https://developer.mozilla.org/en-US/docs/WebAssembly).

Disclaimer: all the following steps were done on linux ubuntu. I am working on a tutorial
to do it on windows. Also, if you want a higher level of abstraction, you can use [wasi-sdk](https://github.com/WebAssembly/wasi-sdk).

### WASI-libc

As argon2 is using some functions from the `libc`, we must have the definitions and implementations for those functions
in the Web Assembly environment working with the linear memory.

For this reason, you first have to install the `wasi-libc` following instructions from the [official repository](https://github.com/WebAssembly/wasi-libc).

But basically it's two commands:
1. `git clone https://github.com/WebAssembly/wasi-libc.git`
2. `make install INSTALL_DIR=/yourdir/wasi-libc`

For now, `pthread` is not supported by `wasi-libc`. For this reason,
argon2 will be compiled without thread support, which is already something
argon2 team has prepared.

### LLVM and Clang

In this project I am using `clang` compiler to compile C source code to WASM.
As the support for WASM is now production ready, it's very straightforward to compile
C code to WASM.

`sudo apt install llvm lld clang`

### Compiling

To compile argon2 into a wasm module, here is the command:

```bash
clang -v -Wall -O3 \
      --target=wasm32-unknown-wasi \
      --sysroot /mydir/wasi-libc \
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
      -o Glihm.Cryptography.Argon2.Wasm/wwwroot/argon2.wasm \
      ./argon2/src/blake2/blake2b.c \
      ./argon2/src/argon2.c \
      ./argon2/src/core.c \
      ./argon2/src/encoding.c \
      ./argon2/src/ref.c \
      ./src/argon2_full.c \
      -I ./argon2/include/ \
      -I ./argon2/src/ \
      -D ARGON2_NO_THREADS
```

Some important stuff here:

1. `--sysroot /mydir/wasi-libc/`: this allows clang to search for default includes for the linker
in the location we provide. Doing this, the `libc` common headers like `stdlib.h`, `strings.h`, etc..
will link to the `wasi` ready library!

2. `--export...`: all the exports are the functions we want available from our wasm module. Note here,
some of the `libc` functions are exported. This allows the javascript working with the wasm module
to interact directy with the linear memory in a very easy way.

3. `--rtlib=compiler-rt`: this one has me struggled a little time before being able to compile.
If you forget this option, there is an error with `lgcc`, which we are not using now.
And when you use this option, a library may be missing when compiling. You can find this library in the [wasi-sdk](https://github.com/jedisct1/libclang_rt.builtins-wasm32.a) precompiled,
and then it must be copied in the path mentioned by the error, for instance:

    `sudo cp ~/downloads/libclang_rt.builtins-wasm32.a /usr/lib/llvm-14/lib/clang/14.0.0/lib/wasi/`

4. `-D ARGON2_NO_THREADS`: defining a flag proposed by argon2 C reference implementation to disable thread support.

5. `./src/argon2_full.c`: the file containing the argon2 extension mentioned earlier, where the `secret` and the `associated data` can be used.

This produces a `argon2.wasm` file, ready to be imported by javascript.

## Contributing

Any PR, issue, comments are very welcomed, and I hope this project will generate some interest for some of you, dear readers!

## TODO

1. A docker image with some pre-configured stuff to run a GitHub CI.
2. Completing the test suite from C implementation for argon2i and argon2d.
3. Reducing the WASM size, as some symboles are not used, but I don't know why I can't strip them using optimizations.
4. Explorating work using `workers` on the web + `SharedArrayBuffer` support enable to support `pthread` in the browser.
5. Check if it's interesting to call the argon2 unmodified functions when `secret` and `associated data` are null.
6. Optimize the WASM fetching... For now, it's fetched anytime it is instanciated.. Need an internal cache system. Instead of using `instantiateStreaming`,
   we can use `instantiate` and cache the buffer. But is it safe? is it ok? Of it's better to cache the module itself?
