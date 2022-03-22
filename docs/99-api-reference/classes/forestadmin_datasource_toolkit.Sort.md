[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / Sort

# Class: Sort

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).Sort

## Hierarchy

- `Array`<[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)\>

  ↳ **`Sort`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.Sort.md#constructor)

### Properties

- [length](forestadmin_datasource_toolkit.Sort.md#length)
- [[species]](forestadmin_datasource_toolkit.Sort.md#[species])

### Accessors

- [projection](forestadmin_datasource_toolkit.Sort.md#projection)

### Methods

- [[iterator]](forestadmin_datasource_toolkit.Sort.md#[iterator])
- [[unscopables]](forestadmin_datasource_toolkit.Sort.md#[unscopables])
- [apply](forestadmin_datasource_toolkit.Sort.md#apply)
- [at](forestadmin_datasource_toolkit.Sort.md#at)
- [concat](forestadmin_datasource_toolkit.Sort.md#concat)
- [copyWithin](forestadmin_datasource_toolkit.Sort.md#copywithin)
- [entries](forestadmin_datasource_toolkit.Sort.md#entries)
- [every](forestadmin_datasource_toolkit.Sort.md#every)
- [fill](forestadmin_datasource_toolkit.Sort.md#fill)
- [filter](forestadmin_datasource_toolkit.Sort.md#filter)
- [find](forestadmin_datasource_toolkit.Sort.md#find)
- [findIndex](forestadmin_datasource_toolkit.Sort.md#findindex)
- [flat](forestadmin_datasource_toolkit.Sort.md#flat)
- [flatMap](forestadmin_datasource_toolkit.Sort.md#flatmap)
- [forEach](forestadmin_datasource_toolkit.Sort.md#foreach)
- [includes](forestadmin_datasource_toolkit.Sort.md#includes)
- [indexOf](forestadmin_datasource_toolkit.Sort.md#indexof)
- [inverse](forestadmin_datasource_toolkit.Sort.md#inverse)
- [join](forestadmin_datasource_toolkit.Sort.md#join)
- [keys](forestadmin_datasource_toolkit.Sort.md#keys)
- [lastIndexOf](forestadmin_datasource_toolkit.Sort.md#lastindexof)
- [map](forestadmin_datasource_toolkit.Sort.md#map)
- [nest](forestadmin_datasource_toolkit.Sort.md#nest)
- [pop](forestadmin_datasource_toolkit.Sort.md#pop)
- [push](forestadmin_datasource_toolkit.Sort.md#push)
- [reduce](forestadmin_datasource_toolkit.Sort.md#reduce)
- [reduceRight](forestadmin_datasource_toolkit.Sort.md#reduceright)
- [replaceClauses](forestadmin_datasource_toolkit.Sort.md#replaceclauses)
- [reverse](forestadmin_datasource_toolkit.Sort.md#reverse)
- [shift](forestadmin_datasource_toolkit.Sort.md#shift)
- [slice](forestadmin_datasource_toolkit.Sort.md#slice)
- [some](forestadmin_datasource_toolkit.Sort.md#some)
- [sort](forestadmin_datasource_toolkit.Sort.md#sort)
- [splice](forestadmin_datasource_toolkit.Sort.md#splice)
- [toLocaleString](forestadmin_datasource_toolkit.Sort.md#tolocalestring)
- [toString](forestadmin_datasource_toolkit.Sort.md#tostring)
- [unnest](forestadmin_datasource_toolkit.Sort.md#unnest)
- [unshift](forestadmin_datasource_toolkit.Sort.md#unshift)
- [values](forestadmin_datasource_toolkit.Sort.md#values)
- [from](forestadmin_datasource_toolkit.Sort.md#from)
- [isArray](forestadmin_datasource_toolkit.Sort.md#isarray)
- [of](forestadmin_datasource_toolkit.Sort.md#of)

## Constructors

### constructor

• **new Sort**(`arrayLength`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `arrayLength` | `number` |

#### Inherited from

Array<SortClause\>.constructor

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1455

• **new Sort**(...`items`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...items` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[] |

#### Inherited from

Array<SortClause\>.constructor

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1456

## Properties

### length

• **length**: `number`

Gets or sets the length of the array. This is a number one higher than the highest index in the array.

#### Inherited from

Array.length

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1273

___

### [species]

▪ `Static` `Readonly` **[species]**: `ArrayConstructor`

#### Inherited from

Array.\_\_@species@57483

#### Defined in

node_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:314

## Accessors

### projection

• `get` **projection**(): [`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Returns

[`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L8)

## Methods

### [iterator]

▸ **[iterator]**(): `IterableIterator`<[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)\>

Iterator

#### Returns

`IterableIterator`<[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)\>

#### Inherited from

Array.\_\_@iterator@56972

#### Defined in

node_modules/typescript/lib/lib.es2015.iterable.d.ts:60

___

### [unscopables]

▸ **[unscopables]**(): `Object`

Returns an object whose properties have the value 'true'
when they will be absent when used in a 'with' statement.

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `copyWithin` | `boolean` |
| `entries` | `boolean` |
| `fill` | `boolean` |
| `find` | `boolean` |
| `findIndex` | `boolean` |
| `keys` | `boolean` |
| `values` | `boolean` |

#### Inherited from

Array.\_\_@unscopables@56974

#### Defined in

node_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:99

___

### apply

▸ **apply**(`records`): [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:41](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L41)

___

### at

▸ **at**(`index`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

Takes an integer value and returns the item at that index,
allowing for positive and negative integers.
Negative integers count back from the last item in the array.

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.at

#### Defined in

node_modules/@types/node/globals.d.ts:86

___

### concat

▸ **concat**(...`items`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

Combines two or more arrays.
This method returns a new array without modifying any existing arrays.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | `ConcatArray`<[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)\>[] | Additional arrays and/or items to add to the end of the array. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

#### Inherited from

Array.concat

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1297

▸ **concat**(...`items`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

Combines two or more arrays.
This method returns a new array without modifying any existing arrays.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | ([`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) \| `ConcatArray`<[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)\>)[] | Additional arrays and/or items to add to the end of the array. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

#### Inherited from

Array.concat

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1303

___

### copyWithin

▸ **copyWithin**(`target`, `start`, `end?`): [`Sort`](forestadmin_datasource_toolkit.Sort.md)

Returns the this object after copying a section of the array identified by start and end
to the same array starting at position target

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `target` | `number` | If target is negative, it is treated as length+target where length is the length of the array. |
| `start` | `number` | If start is negative, it is treated as length+start. If end is negative, it is treated as length+end. |
| `end?` | `number` | If not specified, length of the this object is used as its default value. |

#### Returns

[`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Inherited from

Array.copyWithin

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:64

___

### entries

▸ **entries**(): `IterableIterator`<[`number`, [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)]\>

Returns an iterable of key, value pairs for every entry in the array

#### Returns

`IterableIterator`<[`number`, [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)]\>

#### Inherited from

Array.entries

#### Defined in

node_modules/typescript/lib/lib.es2015.iterable.d.ts:65

___

### every

▸ **every**<`S`\>(`predicate`, `thisArg?`): this is S[]

Determines whether all the members of an array satisfy the specified test.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `S` | extends [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => value is S | A function that accepts up to three arguments. The every method calls the predicate function for each element in the array until the predicate returns a value which is coercible to the Boolean value false, or until the end of the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

this is S[]

#### Inherited from

Array.every

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1380

▸ **every**(`predicate`, `thisArg?`): `boolean`

Determines whether all the members of an array satisfy the specified test.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `unknown` | A function that accepts up to three arguments. The every method calls the predicate function for each element in the array until the predicate returns a value which is coercible to the Boolean value false, or until the end of the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`boolean`

#### Inherited from

Array.every

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1389

___

### fill

▸ **fill**(`value`, `start?`, `end?`): [`Sort`](forestadmin_datasource_toolkit.Sort.md)

Changes all array elements from `start` to `end` index to a static `value` and returns the modified array

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `value` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) | value to fill array section with |
| `start?` | `number` | index to start filling the array at. If start is negative, it is treated as length+start where length is the length of the array. |
| `end?` | `number` | index to stop filling the array at. If end is negative, it is treated as length+end. |

#### Returns

[`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Inherited from

Array.fill

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:53

___

### filter

▸ **filter**<`S`\>(`predicate`, `thisArg?`): `S`[]

Returns the elements of an array that meet the condition specified in a callback function.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `S` | extends [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => value is S | A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`S`[]

#### Inherited from

Array.filter

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1416

▸ **filter**(`predicate`, `thisArg?`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

Returns the elements of an array that meet the condition specified in a callback function.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `unknown` | A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

#### Inherited from

Array.filter

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1422

___

### find

▸ **find**<`S`\>(`predicate`, `thisArg?`): `S`

Returns the value of the first element in the array where predicate is true, and undefined
otherwise.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `S` | extends [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `obj`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => value is S | find calls predicate once for each element of the array, in ascending order, until it finds one where predicate returns true. If such an element is found, find immediately returns that element value. Otherwise, find returns undefined. |
| `thisArg?` | `any` | If provided, it will be used as the this value for each invocation of predicate. If it is not provided, undefined is used instead. |

#### Returns

`S`

#### Inherited from

Array.find

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:31

▸ **find**(`predicate`, `thisArg?`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Parameters

| Name | Type |
| :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `obj`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `unknown` |
| `thisArg?` | `any` |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.find

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:32

___

### findIndex

▸ **findIndex**(`predicate`, `thisArg?`): `number`

Returns the index of the first element in the array where predicate is true, and -1
otherwise.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `obj`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `unknown` | find calls predicate once for each element of the array, in ascending order, until it finds one where predicate returns true. If such an element is found, findIndex immediately returns that element index. Otherwise, findIndex returns -1. |
| `thisArg?` | `any` | If provided, it will be used as the this value for each invocation of predicate. If it is not provided, undefined is used instead. |

#### Returns

`number`

#### Inherited from

Array.findIndex

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:43

___

### flat

▸ **flat**<`A`, `D`\>(`depth?`): `FlatArray`<`A`, `D`\>[]

Returns a new array with all sub-array elements concatenated into it recursively up to the
specified depth.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `A` | `A` |
| `D` | extends `number` = ``1`` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `depth?` | `D` | The maximum recursion depth |

#### Returns

`FlatArray`<`A`, `D`\>[]

#### Inherited from

Array.flat

#### Defined in

node_modules/typescript/lib/lib.es2019.array.d.ts:81

___

### flatMap

▸ **flatMap**<`U`, `This`\>(`callback`, `thisArg?`): `U`[]

Calls a defined callback function on each element of an array. Then, flattens the result into
a new array.
This is identical to a map followed by flat with depth 1.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `U` | `U` |
| `This` | `undefined` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callback` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `U` \| readonly `U`[] | A function that accepts up to three arguments. The flatMap method calls the callback function one time for each element in the array. |
| `thisArg?` | `This` | An object to which the this keyword can refer in the callback function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`U`[]

#### Inherited from

Array.flatMap

#### Defined in

node_modules/typescript/lib/lib.es2019.array.d.ts:70

___

### forEach

▸ **forEach**(`callbackfn`, `thisArg?`): `void`

Performs the specified action for each element in an array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `void` | A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`void`

#### Inherited from

Array.forEach

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1404

___

### includes

▸ **includes**(`searchElement`, `fromIndex?`): `boolean`

Determines whether an array includes a certain element, returning true or false as appropriate.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `searchElement` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) | The element to search for. |
| `fromIndex?` | `number` | The position in this array at which to begin searching for searchElement. |

#### Returns

`boolean`

#### Inherited from

Array.includes

#### Defined in

node_modules/typescript/lib/lib.es2016.array.include.d.ts:27

___

### indexOf

▸ **indexOf**(`searchElement`, `fromIndex?`): `number`

Returns the index of the first occurrence of a value in an array, or -1 if it is not present.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `searchElement` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) | The value to locate in the array. |
| `fromIndex?` | `number` | The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0. |

#### Returns

`number`

#### Inherited from

Array.indexOf

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1365

___

### inverse

▸ **inverse**(): [`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Returns

[`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L24)

___

### join

▸ **join**(`separator?`): `string`

Adds all the elements of an array into a string, separated by the specified separator string.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `separator?` | `string` | A string used to separate one element of the array from the next in the resulting string. If omitted, the array elements are separated with a comma. |

#### Returns

`string`

#### Inherited from

Array.join

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1308

___

### keys

▸ **keys**(): `IterableIterator`<`number`\>

Returns an iterable of keys in the array

#### Returns

`IterableIterator`<`number`\>

#### Inherited from

Array.keys

#### Defined in

node_modules/typescript/lib/lib.es2015.iterable.d.ts:70

___

### lastIndexOf

▸ **lastIndexOf**(`searchElement`, `fromIndex?`): `number`

Returns the index of the last occurrence of a specified value in an array, or -1 if it is not present.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `searchElement` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) | The value to locate in the array. |
| `fromIndex?` | `number` | The array index at which to begin searching backward. If fromIndex is omitted, the search starts at the last index in the array. |

#### Returns

`number`

#### Inherited from

Array.lastIndexOf

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1371

___

### map

▸ **map**<`U`\>(`callbackfn`, `thisArg?`): `U`[]

Calls a defined callback function on each element of an array, and returns an array that contains the results.

#### Type parameters

| Name |
| :------ |
| `U` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `U` | A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`U`[]

#### Inherited from

Array.map

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1410

___

### nest

▸ **nest**(`prefix`): [`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L18)

___

### pop

▸ **pop**(): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

Removes the last element from an array and returns it.
If the array is empty, undefined is returned and the array is not modified.

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.pop

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1286

___

### push

▸ **push**(...`items`): `number`

Appends new elements to the end of an array, and returns the new length of the array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[] | New elements to add to the array. |

#### Returns

`number`

#### Inherited from

Array.push

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1291

___

### reduce

▸ **reduce**(`callbackfn`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`previousValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentIndex`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) | A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.reduce

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1428

▸ **reduce**(`callbackfn`, `initialValue`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackfn` | (`previousValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentIndex`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) |
| `initialValue` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.reduce

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1429

▸ **reduce**<`U`\>(`callbackfn`, `initialValue`): `U`

Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.

#### Type parameters

| Name |
| :------ |
| `U` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`previousValue`: `U`, `currentValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentIndex`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `U` | A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array. |
| `initialValue` | `U` | If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value. |

#### Returns

`U`

#### Inherited from

Array.reduce

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1435

___

### reduceRight

▸ **reduceRight**(`callbackfn`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`previousValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentIndex`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) | A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.reduceRight

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1441

▸ **reduceRight**(`callbackfn`, `initialValue`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackfn` | (`previousValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentIndex`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) |
| `initialValue` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.reduceRight

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1442

▸ **reduceRight**<`U`\>(`callbackfn`, `initialValue`): `U`

Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.

#### Type parameters

| Name |
| :------ |
| `U` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`previousValue`: `U`, `currentValue`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `currentIndex`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `U` | A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array. |
| `initialValue` | `U` | If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value. |

#### Returns

`U`

#### Inherited from

Array.reduceRight

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1448

___

### replaceClauses

▸ **replaceClauses**(`callback`): [`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `callback` | (`clause`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)) => [`Sort`](forestadmin_datasource_toolkit.Sort.md) \| [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause) \| [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[] |

#### Returns

[`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L12)

___

### reverse

▸ **reverse**(): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

Reverses the elements in an array in place.
This method mutates the array and returns a reference to the same array.

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

#### Inherited from

Array.reverse

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1313

___

### shift

▸ **shift**(): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

Removes the first element from an array and returns it.
If the array is empty, undefined is returned and the array is not modified.

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)

#### Inherited from

Array.shift

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1318

___

### slice

▸ **slice**(`start?`, `end?`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

Returns a copy of a section of an array.
For both start and end, a negative index can be used to indicate an offset from the end of the array.
For example, -2 refers to the second to last element of the array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `start?` | `number` | The beginning index of the specified portion of the array. If start is undefined, then the slice begins at index 0. |
| `end?` | `number` | The end index of the specified portion of the array. This is exclusive of the element at the index 'end'. If end is undefined, then the slice extends to the end of the array. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

#### Inherited from

Array.slice

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1328

___

### some

▸ **some**(`predicate`, `thisArg?`): `boolean`

Determines whether the specified callback function returns true for any element of an array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `index`: `number`, `array`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]) => `unknown` | A function that accepts up to three arguments. The some method calls the predicate function for each element in the array until the predicate returns a value which is coercible to the Boolean value true, or until the end of the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`boolean`

#### Inherited from

Array.some

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1398

___

### sort

▸ **sort**(`compareFn?`): [`Sort`](forestadmin_datasource_toolkit.Sort.md)

Sorts an array in place.
This method mutates the array and returns a reference to the same array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `compareFn?` | (`a`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause), `b`: [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)) => `number` | Function used to determine the order of the elements. It is expected to return a negative value if the first argument is less than the second argument, zero if they're equal, and a positive value otherwise. If omitted, the elements are sorted in ascending, ASCII character order. ```ts [11,2,22,1].sort((a, b) => a - b) ``` |

#### Returns

[`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Inherited from

Array.sort

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1339

___

### splice

▸ **splice**(`start`, `deleteCount?`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `start` | `number` | The zero-based location in the array from which to start removing elements. |
| `deleteCount?` | `number` | The number of elements to remove. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

An array containing the elements that were deleted.

#### Inherited from

Array.splice

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1346

▸ **splice**(`start`, `deleteCount`, ...`items`): [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `start` | `number` | The zero-based location in the array from which to start removing elements. |
| `deleteCount` | `number` | The number of elements to remove. |
| `...items` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[] | Elements to insert into the array in place of the deleted elements. |

#### Returns

[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[]

An array containing the elements that were deleted.

#### Inherited from

Array.splice

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1354

___

### toLocaleString

▸ **toLocaleString**(): `string`

Returns a string representation of an array. The elements are converted to string using their toLocaleString methods.

#### Returns

`string`

#### Inherited from

Array.toLocaleString

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1281

___

### toString

▸ **toString**(): `string`

Returns a string representation of an array.

#### Returns

`string`

#### Inherited from

Array.toString

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1277

___

### unnest

▸ **unnest**(): [`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Returns

[`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:28](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L28)

___

### unshift

▸ **unshift**(...`items`): `number`

Inserts new elements at the start of an array, and returns the new length of the array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | [`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)[] | Elements to insert at the start of the array. |

#### Returns

`number`

#### Inherited from

Array.unshift

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1359

___

### values

▸ **values**(): `IterableIterator`<[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)\>

Returns an iterable of values in the array

#### Returns

`IterableIterator`<[`SortClause`](../modules/forestadmin_datasource_toolkit.md#sortclause)\>

#### Inherited from

Array.values

#### Defined in

node_modules/typescript/lib/lib.es2015.iterable.d.ts:75

___

### from

▸ `Static` **from**<`T`\>(`arrayLike`): `T`[]

Creates an array from an array-like object.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `arrayLike` | `ArrayLike`<`T`\> | An array-like object to convert to an array. |

#### Returns

`T`[]

#### Inherited from

Array.from

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:72

▸ `Static` **from**<`T`, `U`\>(`arrayLike`, `mapfn`, `thisArg?`): `U`[]

Creates an array from an iterable object.

#### Type parameters

| Name |
| :------ |
| `T` |
| `U` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `arrayLike` | `ArrayLike`<`T`\> | An array-like object to convert to an array. |
| `mapfn` | (`v`: `T`, `k`: `number`) => `U` | A mapping function to call on every element of the array. |
| `thisArg?` | `any` | Value of 'this' used to invoke the mapfn. |

#### Returns

`U`[]

#### Inherited from

Array.from

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:80

▸ `Static` **from**<`T`\>(`iterable`): `T`[]

Creates an array from an iterable object.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `iterable` | `Iterable`<`T`\> \| `ArrayLike`<`T`\> | An iterable object to convert to an array. |

#### Returns

`T`[]

#### Inherited from

Array.from

#### Defined in

node_modules/typescript/lib/lib.es2015.iterable.d.ts:83

▸ `Static` **from**<`T`, `U`\>(`iterable`, `mapfn`, `thisArg?`): `U`[]

Creates an array from an iterable object.

#### Type parameters

| Name |
| :------ |
| `T` |
| `U` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `iterable` | `Iterable`<`T`\> \| `ArrayLike`<`T`\> | An iterable object to convert to an array. |
| `mapfn` | (`v`: `T`, `k`: `number`) => `U` | A mapping function to call on every element of the array. |
| `thisArg?` | `any` | Value of 'this' used to invoke the mapfn. |

#### Returns

`U`[]

#### Inherited from

Array.from

#### Defined in

node_modules/typescript/lib/lib.es2015.iterable.d.ts:91

___

### isArray

▸ `Static` **isArray**(`arg`): arg is any[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `arg` | `any` |

#### Returns

arg is any[]

#### Inherited from

Array.isArray

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1460

___

### of

▸ `Static` **of**<`T`\>(...`items`): `T`[]

Returns a new array from a set of elements.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | `T`[] | A set of elements to include in the new array object. |

#### Returns

`T`[]

#### Inherited from

Array.of

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:86
