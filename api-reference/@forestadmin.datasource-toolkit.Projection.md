# Class: Projection

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).Projection

## Hierarchy

- `Array`<`string`\>

  ↳ **`Projection`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.Projection#constructor)

### Properties

- [length](../wiki/@forestadmin.datasource-toolkit.Projection#length)
- [[species]](../wiki/@forestadmin.datasource-toolkit.Projection#%5Bspecies%5D)

### Accessors

- [columns](../wiki/@forestadmin.datasource-toolkit.Projection#columns)
- [relations](../wiki/@forestadmin.datasource-toolkit.Projection#relations)

### Methods

- [[iterator]](../wiki/@forestadmin.datasource-toolkit.Projection#%5Biterator%5D)
- [[unscopables]](../wiki/@forestadmin.datasource-toolkit.Projection#%5Bunscopables%5D)
- [apply](../wiki/@forestadmin.datasource-toolkit.Projection#apply)
- [at](../wiki/@forestadmin.datasource-toolkit.Projection#at)
- [concat](../wiki/@forestadmin.datasource-toolkit.Projection#concat)
- [copyWithin](../wiki/@forestadmin.datasource-toolkit.Projection#copywithin)
- [entries](../wiki/@forestadmin.datasource-toolkit.Projection#entries)
- [every](../wiki/@forestadmin.datasource-toolkit.Projection#every)
- [fill](../wiki/@forestadmin.datasource-toolkit.Projection#fill)
- [filter](../wiki/@forestadmin.datasource-toolkit.Projection#filter)
- [find](../wiki/@forestadmin.datasource-toolkit.Projection#find)
- [findIndex](../wiki/@forestadmin.datasource-toolkit.Projection#findindex)
- [flat](../wiki/@forestadmin.datasource-toolkit.Projection#flat)
- [flatMap](../wiki/@forestadmin.datasource-toolkit.Projection#flatmap)
- [forEach](../wiki/@forestadmin.datasource-toolkit.Projection#foreach)
- [includes](../wiki/@forestadmin.datasource-toolkit.Projection#includes)
- [indexOf](../wiki/@forestadmin.datasource-toolkit.Projection#indexof)
- [join](../wiki/@forestadmin.datasource-toolkit.Projection#join)
- [keys](../wiki/@forestadmin.datasource-toolkit.Projection#keys)
- [lastIndexOf](../wiki/@forestadmin.datasource-toolkit.Projection#lastindexof)
- [map](../wiki/@forestadmin.datasource-toolkit.Projection#map)
- [nest](../wiki/@forestadmin.datasource-toolkit.Projection#nest)
- [pop](../wiki/@forestadmin.datasource-toolkit.Projection#pop)
- [push](../wiki/@forestadmin.datasource-toolkit.Projection#push)
- [reduce](../wiki/@forestadmin.datasource-toolkit.Projection#reduce)
- [reduceRight](../wiki/@forestadmin.datasource-toolkit.Projection#reduceright)
- [replace](../wiki/@forestadmin.datasource-toolkit.Projection#replace)
- [reverse](../wiki/@forestadmin.datasource-toolkit.Projection#reverse)
- [shift](../wiki/@forestadmin.datasource-toolkit.Projection#shift)
- [slice](../wiki/@forestadmin.datasource-toolkit.Projection#slice)
- [some](../wiki/@forestadmin.datasource-toolkit.Projection#some)
- [sort](../wiki/@forestadmin.datasource-toolkit.Projection#sort)
- [splice](../wiki/@forestadmin.datasource-toolkit.Projection#splice)
- [toLocaleString](../wiki/@forestadmin.datasource-toolkit.Projection#tolocalestring)
- [toString](../wiki/@forestadmin.datasource-toolkit.Projection#tostring)
- [union](../wiki/@forestadmin.datasource-toolkit.Projection#union)
- [unnest](../wiki/@forestadmin.datasource-toolkit.Projection#unnest)
- [unshift](../wiki/@forestadmin.datasource-toolkit.Projection#unshift)
- [values](../wiki/@forestadmin.datasource-toolkit.Projection#values)
- [withPks](../wiki/@forestadmin.datasource-toolkit.Projection#withpks)
- [from](../wiki/@forestadmin.datasource-toolkit.Projection#from)
- [isArray](../wiki/@forestadmin.datasource-toolkit.Projection#isarray)
- [of](../wiki/@forestadmin.datasource-toolkit.Projection#of)

## Constructors

### constructor

• **new Projection**(`arrayLength`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `arrayLength` | `number` |

#### Inherited from

Array<string\>.constructor

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1455

• **new Projection**(...`items`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...items` | `string`[] |

#### Inherited from

Array<string\>.constructor

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

### columns

• `get` **columns**(): `string`[]

#### Returns

`string`[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:7](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L7)

___

### relations

• `get` **relations**(): `Record`<`string`, [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)\>

#### Returns

`Record`<`string`, [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L11)

## Methods

### [iterator]

▸ **[iterator]**(): `IterableIterator`<`string`\>

Iterator

#### Returns

`IterableIterator`<`string`\>

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

▸ **apply**(`records`): [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |

#### Returns

[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:41](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L41)

___

### at

▸ **at**(`index`): `string`

Takes an integer value and returns the item at that index,
allowing for positive and negative integers.
Negative integers count back from the last item in the array.

#### Parameters

| Name | Type |
| :------ | :------ |
| `index` | `number` |

#### Returns

`string`

#### Inherited from

Array.at

#### Defined in

node_modules/@types/node/globals.d.ts:86

___

### concat

▸ **concat**(...`items`): `string`[]

Combines two or more arrays.
This method returns a new array without modifying any existing arrays.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | `ConcatArray`<`string`\>[] | Additional arrays and/or items to add to the end of the array. |

#### Returns

`string`[]

#### Inherited from

Array.concat

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1297

▸ **concat**(...`items`): `string`[]

Combines two or more arrays.
This method returns a new array without modifying any existing arrays.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | (`string` \| `ConcatArray`<`string`\>)[] | Additional arrays and/or items to add to the end of the array. |

#### Returns

`string`[]

#### Inherited from

Array.concat

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1303

___

### copyWithin

▸ **copyWithin**(`target`, `start`, `end?`): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

Returns the this object after copying a section of the array identified by start and end
to the same array starting at position target

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `target` | `number` | If target is negative, it is treated as length+target where length is the length of the array. |
| `start` | `number` | If start is negative, it is treated as length+start. If end is negative, it is treated as length+end. |
| `end?` | `number` | If not specified, length of the this object is used as its default value. |

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Inherited from

Array.copyWithin

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:64

___

### entries

▸ **entries**(): `IterableIterator`<[`number`, `string`]\>

Returns an iterable of key, value pairs for every entry in the array

#### Returns

`IterableIterator`<[`number`, `string`]\>

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
| `S` | extends `string` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => value is S | A function that accepts up to three arguments. The every method calls the predicate function for each element in the array until the predicate returns a value which is coercible to the Boolean value false, or until the end of the array. |
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
| `predicate` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => `unknown` | A function that accepts up to three arguments. The every method calls the predicate function for each element in the array until the predicate returns a value which is coercible to the Boolean value false, or until the end of the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`boolean`

#### Inherited from

Array.every

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1389

___

### fill

▸ **fill**(`value`, `start?`, `end?`): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

Changes all array elements from `start` to `end` index to a static `value` and returns the modified array

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `value` | `string` | value to fill array section with |
| `start?` | `number` | index to start filling the array at. If start is negative, it is treated as length+start where length is the length of the array. |
| `end?` | `number` | index to stop filling the array at. If end is negative, it is treated as length+end. |

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

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
| `S` | extends `string` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => value is S | A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`S`[]

#### Inherited from

Array.filter

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1416

▸ **filter**(`predicate`, `thisArg?`): `string`[]

Returns the elements of an array that meet the condition specified in a callback function.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => `unknown` | A function that accepts up to three arguments. The filter method calls the predicate function one time for each element in the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`string`[]

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
| `S` | extends `string` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `predicate` | (`value`: `string`, `index`: `number`, `obj`: `string`[]) => value is S | find calls predicate once for each element of the array, in ascending order, until it finds one where predicate returns true. If such an element is found, find immediately returns that element value. Otherwise, find returns undefined. |
| `thisArg?` | `any` | If provided, it will be used as the this value for each invocation of predicate. If it is not provided, undefined is used instead. |

#### Returns

`S`

#### Inherited from

Array.find

#### Defined in

node_modules/typescript/lib/lib.es2015.core.d.ts:31

▸ **find**(`predicate`, `thisArg?`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `predicate` | (`value`: `string`, `index`: `number`, `obj`: `string`[]) => `unknown` |
| `thisArg?` | `any` |

#### Returns

`string`

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
| `predicate` | (`value`: `string`, `index`: `number`, `obj`: `string`[]) => `unknown` | find calls predicate once for each element of the array, in ascending order, until it finds one where predicate returns true. If such an element is found, findIndex immediately returns that element index. Otherwise, findIndex returns -1. |
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
| `callback` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => `U` \| readonly `U`[] | A function that accepts up to three arguments. The flatMap method calls the callback function one time for each element in the array. |
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
| `callbackfn` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => `void` | A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array. |
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
| `searchElement` | `string` | The element to search for. |
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
| `searchElement` | `string` | The value to locate in the array. |
| `fromIndex?` | `number` | The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0. |

#### Returns

`number`

#### Inherited from

Array.indexOf

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1365

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
| `searchElement` | `string` | The value to locate in the array. |
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
| `callbackfn` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => `U` | A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`U`[]

#### Inherited from

Array.map

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1410

___

### nest

▸ **nest**(`prefix`): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:65](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L65)

___

### pop

▸ **pop**(): `string`

Removes the last element from an array and returns it.
If the array is empty, undefined is returned and the array is not modified.

#### Returns

`string`

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
| `...items` | `string`[] | New elements to add to the array. |

#### Returns

`number`

#### Inherited from

Array.push

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1291

___

### reduce

▸ **reduce**(`callbackfn`): `string`

Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`previousValue`: `string`, `currentValue`: `string`, `currentIndex`: `number`, `array`: `string`[]) => `string` | A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array. |

#### Returns

`string`

#### Inherited from

Array.reduce

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1428

▸ **reduce**(`callbackfn`, `initialValue`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackfn` | (`previousValue`: `string`, `currentValue`: `string`, `currentIndex`: `number`, `array`: `string`[]) => `string` |
| `initialValue` | `string` |

#### Returns

`string`

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
| `callbackfn` | (`previousValue`: `U`, `currentValue`: `string`, `currentIndex`: `number`, `array`: `string`[]) => `U` | A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array. |
| `initialValue` | `U` | If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value. |

#### Returns

`U`

#### Inherited from

Array.reduce

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1435

___

### reduceRight

▸ **reduceRight**(`callbackfn`): `string`

Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `callbackfn` | (`previousValue`: `string`, `currentValue`: `string`, `currentIndex`: `number`, `array`: `string`[]) => `string` | A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array. |

#### Returns

`string`

#### Inherited from

Array.reduceRight

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1441

▸ **reduceRight**(`callbackfn`, `initialValue`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `callbackfn` | (`previousValue`: `string`, `currentValue`: `string`, `currentIndex`: `number`, `array`: `string`[]) => `string` |
| `initialValue` | `string` |

#### Returns

`string`

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
| `callbackfn` | (`previousValue`: `U`, `currentValue`: `string`, `currentIndex`: `number`, `array`: `string`[]) => `U` | A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array. |
| `initialValue` | `U` | If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value. |

#### Returns

`U`

#### Inherited from

Array.reduceRight

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1448

___

### replace

▸ **replace**(`handler`, `bind?`): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | (`path`: `string`) => `string` \| `string`[] \| [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection) |
| `bind?` | `unknown` |

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L24)

___

### reverse

▸ **reverse**(): `string`[]

Reverses the elements in an array in place.
This method mutates the array and returns a reference to the same array.

#### Returns

`string`[]

#### Inherited from

Array.reverse

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1313

___

### shift

▸ **shift**(): `string`

Removes the first element from an array and returns it.
If the array is empty, undefined is returned and the array is not modified.

#### Returns

`string`

#### Inherited from

Array.shift

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1318

___

### slice

▸ **slice**(`start?`, `end?`): `string`[]

Returns a copy of a section of an array.
For both start and end, a negative index can be used to indicate an offset from the end of the array.
For example, -2 refers to the second to last element of the array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `start?` | `number` | The beginning index of the specified portion of the array. If start is undefined, then the slice begins at index 0. |
| `end?` | `number` | The end index of the specified portion of the array. This is exclusive of the element at the index 'end'. If end is undefined, then the slice extends to the end of the array. |

#### Returns

`string`[]

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
| `predicate` | (`value`: `string`, `index`: `number`, `array`: `string`[]) => `unknown` | A function that accepts up to three arguments. The some method calls the predicate function for each element in the array until the predicate returns a value which is coercible to the Boolean value true, or until the end of the array. |
| `thisArg?` | `any` | An object to which the this keyword can refer in the predicate function. If thisArg is omitted, undefined is used as the this value. |

#### Returns

`boolean`

#### Inherited from

Array.some

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1398

___

### sort

▸ **sort**(`compareFn?`): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

Sorts an array in place.
This method mutates the array and returns a reference to the same array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `compareFn?` | (`a`: `string`, `b`: `string`) => `number` | Function used to determine the order of the elements. It is expected to return a negative value if the first argument is less than the second argument, zero if they're equal, and a positive value otherwise. If omitted, the elements are sorted in ascending, ASCII character order. ```ts [11,2,22,1].sort((a, b) => a - b) ``` |

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Inherited from

Array.sort

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1339

___

### splice

▸ **splice**(`start`, `deleteCount?`): `string`[]

Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `start` | `number` | The zero-based location in the array from which to start removing elements. |
| `deleteCount?` | `number` | The number of elements to remove. |

#### Returns

`string`[]

An array containing the elements that were deleted.

#### Inherited from

Array.splice

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1346

▸ **splice**(`start`, `deleteCount`, ...`items`): `string`[]

Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `start` | `number` | The zero-based location in the array from which to start removing elements. |
| `deleteCount` | `number` | The number of elements to remove. |
| `...items` | `string`[] | Elements to insert into the array in place of the deleted elements. |

#### Returns

`string`[]

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

### union

▸ **union**(...`otherProjections`): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...otherProjections` | (`string`[] \| [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection))[] |

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:32](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L32)

___

### unnest

▸ **unnest**(): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L69)

___

### unshift

▸ **unshift**(...`items`): `number`

Inserts new elements at the start of an array, and returns the new length of the array.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `...items` | `string`[] | Elements to insert at the start of the array. |

#### Returns

`number`

#### Inherited from

Array.unshift

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1359

___

### values

▸ **values**(): `IterableIterator`<`string`\>

Returns an iterable of values in the array

#### Returns

`IterableIterator`<`string`\>

#### Inherited from

Array.values

#### Defined in

node_modules/typescript/lib/lib.es2015.iterable.d.ts:75

___

### withPks

▸ **withPks**(`collection`): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/projection.ts:45](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/projection.ts#L45)

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
