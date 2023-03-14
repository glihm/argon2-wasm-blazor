/*
 * Linear memory helper class to work with
 * wasm memory.
 * 
 * The basic concept of this file is to have
 * classes that described the linear memory regions
 * (like pointers) with all the information need to
 * store and load bytes array into the WebAssembly memory.
 */

"use strict";

/**
 * Linear memory handle, a class to represent
 * a region in the wasm linear memory.
 * @class
 */
export class LinearMemoryHandle
{
    /**
     * @constructor
     * @param {number|null} addr - Address in the linear memory.
     * @param {number} length - Length in bytes of the underlying data.
     */
    constructor(addr, length)
    {
        this.addr = addr;
        this.length = length;
    }
}

/**
 * Linear memory class, with few functions to simplify
 * interactions with wasm linear memory.
 * @class
 */
export class LinearMemory
{
    /**
     * @constructor
     * @param {WebAssembly.Memory} memory - [WebAssembly memory]{@link https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory}.
     * @param {Function} allocator - Allocator to use in order to get linear memory heap allocations.
     * @param {Function} deallocator - Deallocator.
     */
    constructor(memory, allocator, deallocator)
    {
        this.memory = memory;
        this.allocator = allocator;
        this.deallocator = deallocator;
    }

    /**
     * Disposes resources related to the given handle.
     * 
     * @param {LinearMemoryHandle} handle
     */
    free(handle)
    {
        this.deallocator(handle.addr);
    }

    /**
     * Allocates memory on the linear memory heap.
     * 
     * @param {number} length - Number of bytes to be allocated.
     * @returns {LinearMemoryHandle} - The handle for the allocated region.
     */
    alloc(length)
    {
        const addr = this.allocator(length);
        return new LinearMemoryHandle(addr, length);
    }

    /**
     * Stores the given array in the linear memory.
     * This allocates required memory on the heap.
     * Must be freed when not used anymore.
     * 
     * @param {Uint8Array} array - Array of bytes to store.
     * @returns {LinearMemoryHandle} - The handle for the allocated region where the array is stored.
     */
    storeArray(array)
    {
        if (!array || array.length === 0)
        {
            return new LinearMemoryHandle(null, 0);
        }

        const handle = this.alloc(array.length);

        const memview = new Uint8Array(this.memory.buffer);
        for (let i = 0; i < handle.length; i++)
        {
            memview[handle.addr + i] = array[i];
        }

        return handle;
    }

    /**
     * Stores a string encoded as UTF-8 in the linear memory
     * as a bytes array.
     * This allocates required memory on the heap.
     * Must be freed when not used anymore.
     * 
     * @param {string} str - String to encode and store.
     * @param {boolean} isNullTerminated - Indicates if the string must be stored with a null terminated character at the end.
     * @returns {LinearMemoryHandle} - The handle for the allocated region where the string is stored.
     */
    storeStr(str, isNullTerminated = true)
    {
        let array = new TextEncoder().encode(str);

        // Terminates the string with null C character to be able to pass this address
        // without the length when C api is expecting a `const char *`.
        if (isNullTerminated)
        {
            array = new Uint8Array([...array, 0]);
        }

        return this.storeArray(array);
    }

    /**
     * Loads a bytes array from the linear memory to a javascript Uint8Array.
     * 
     * @param {LinearMemoryHandle} handle - Linear memory handle.
     * @returns {Uint8Array} - Uint8Array from the linear memory region described by the given handle.
     */
    loadArray(handle)
    {
        if (handle.addr === null || handle.length === 0)
        {
            return null;
        }

        const array = new Uint8Array(Array(handle.length).fill(0));
        const memview = new Uint8Array(this.memory.buffer);

        for (let i = 0; i < handle.length; i++)
        {
            array[i] = memview[handle.addr + i];
        }

        return array;
    }

    /**
     * Loads a string from the linear memory.
     * @param {LinearMemoryHandle} handle - Linear memory handle.
     * @returns {string} - String from the linear memory region described by the given handler.
     */
    loadStr(handle)
    {
        const array = this.loadArray(handle);
        return new TextDecoder().decode(array);
    }
}
