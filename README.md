<p align="center">
  <h1 align="center"><a href-="https://github.com/i31pc17/dbqb">DBQB</a></h1>
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/dbqb"><img src="https://badgen.net/npm/v/dbqb" /></a>
    <a href="LICENSE"><img src="https://badgen.net/github/license/i31pc17/dbqb" /></a>
</p>

<p align="center">mysql query builder</p>

## Examples

```ts
const dbqb = new DBQB({
    /*
     * Query = 'SHOW TABLES'
     * ['table1', 'table2']
     */
    getTables: () => string[],
    /*
     * ※ Query = `SHOW FIELDS FROM ${table}`
     * [
     *      {
     *          Field: 'idx',
     *          Type: 'int'
     *      },
     *      {
     *          Field: 'nick',
     *          Type: 'varchar(32)'
     *      }
     * ]
     */
    getFields: (table: string) => IFieldItem[] 
});

// SELECT * FROM `user` WHERE id = 'test';
const selectQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        id: 'test'
    }
});

// SELECT COUNT(1) AS count FROM `user` WHERE adult_yn = 'Y';
const countQuery = await dbqb.countQuery({
    table: 'user',
    where: {
        adult_yn: 'Y'
    }
});

// INSERT INTO `user` SET id = 'test', nick = 'test';
const insertQuery = await dbqb.insertQuery({
    table: 'user',
    data: {
        id: 'test',
        nick: 'test'
    }
});

// INSERT INTO `user` (id, nick) VALUES ('test', 'test'), ('test2', 'test2');
const insertAllQuery = await dbqb.insertAllQuery({
    table: 'user',
    data: [
        {
            id: 'test',
            nick: 'test',
        },
        {
            id: 'test2',
            nick: 'test2',
        }
    ]
});

// UPDATE `user` SET id = 'test' WHERE id = 'test2';
const updateQuery = await dbqb.updateQuery({
    table: 'user',
    set: {
        id: 'test'
    },
    where: {
        id: 'test2'
    }
});

// INSERT INTO `user` SET id = 'test', nick = 'test' ON DUPLICATE KEY UPDATE nick = 'test';
const insertUpdateQuery = await dbqb.insertUpdateQuery({
    table: 'user',
    data: {
        id: 'test',
        nick: 'test'
    },
    set: {
        nick: 'test'
    }
});

// DELETE FROM `user` WHERE id = 'test';
const deleteQuery = await dbqb.deleteQuery({
    table: 'user',
    where: {
        id: 'test'
    }
});
```

## WHERE
```ts
// id = 'test' AND id != 'test' .....
const where = {
    // id = 'test'
    id: 'test',
    // id != 'test'
    'id !=': 'test',
    // date >= '2022-12-03'
    // `>=` `>` `<=` `<`
    'date >=': '2022-12-03',
    // idx IS NULL
    idx: null,
    // idx IS NOT NULL
    'idx !=': null,
    // id IN ('test', 'test2')
    id: ['test', 'test2'],
    // id NOT IN ('test', 'test2')
    'id !=': ['test', 'test2'],
    // nick LIKE 'test%',
    'nick %': 'test%',
    // nick NOT LIKE
    'nick !%': 'test%',
    // ( nick = 'test' OR id = 'test' OR (adult_yn = 'Y' AND name = 'test2'))
    [Symbol('OR')]: {
        nick: 'test',
        id: 'test',
        [Symbol('AND')]: {
            adult_yn: 'Y',
            name: 'test2'
        }
    },
};

// id = 'test' OR nick = 'test' ...
const whereOr = {};

const query = await dbqb.selectQuery({
    table: 'user',
    where,
    whereOr
});
```
