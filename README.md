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
     * Query = `SHOW FIELDS FROM ${table}`
     * [
     *      { Field: 'idx', Type: 'int', Null: 'NO', Key: 'PRI', Default: '', Extra: 'auto_increment' },
     *      { Field: 'nick', Type: 'varchar(32)', Null: 'NO', Key: '', Default: '', Extra: '' },
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

## WHERE / HAVING
#### where / whereOr / having / havingOr
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
    // nick LIKE 'test%'
    'nick %': 'test%',
    // nick NOT LIKE 'test%'
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
    // `user`.`nick` = `user`.`name`
    user: Symbol('user.name')
};

// id = 'test' OR nick = 'test' ...
const whereOr = {};

const query = await dbqb.selectQuery({
    table: 'user',
    where,
    whereOr
});

// SELECT * FROM `user` WHERE id = 'test' AND nick != "test" AND (field1 = "123" OR field2 = "321");
const whereQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        id: 'test'
    },
    sWhere: 'AND nick != "test" AND (field1 = "123" OR field2 = "321")'
});

// SELECT * FROM `user` WHERE id = nick AND nick = "test";
const bangQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        '!id': 'name',
        '!nick': '"test"'
    }
});
```

## LIMIT
```ts
// SELEC * FROM `user` WHERE adult_yn = 'Y' LIMIT 0, 10;
const limitQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        adult_yn: 'Y'
    },
    offset: 0,
    limit: 10
});
```

## FIELD
```ts
// SELECT user.*, id, nick, name AS user_name, SUM(coin) AS coin_sum FROM `user`;
const fieldQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['*', 'id', 'nick'],
    fieldAs: {
        name: 'user_name',
        'SUM(coin)': 'coin_sum'
    }
});

// SELECT COUNT(IF(adult_yn = "Y", 1, NULL) AS adult_count FROM `user`;
const fieldQuery2 = await dbqb.selectQuery({
    table: 'user',
    fieldAs: {
        '!COUNT(IF(adult_yn = "Y", 1, NULL)': 'adult_count'
    }
});

// SELECT (SELECT name FROM profile WHERE profile.user_idx = user.idx LIMIT 1) AS profile_name FROM `user`;
const fieldQuery3 = await dbqb.selectQuery({
    table: 'user',
    fieldAs: {
        '!(SELECT name FROM profile WHERE profile.user_idx = user.idx LIMIT 1)': 'profile_name'
    }
});
```

## JOIN
#### LEFT / INNER / RIGHT / FULL OUTER
```ts
// SELECT profile.* FROM `profile` LEFT JOIN `user` ON `profile`.user_idx = `user`.idx;
const leftJoinQuery = await dbqb.selectQuery({
    table: 'profile',
    leftJoin: [
        // 1
        {
            table: 'user',
            on: '`profile`.user_idx = `user`.idx'
        },
        // 2
        {
            table: 'user',
            on: {
                idx: Symbol('profile.user_idx')
            }
        },
        // 3
        {
            table: 'user',
            on: 'profile.user_idx'
        }
    ]
});

// SELECT user.id, user.name, profile.name AS profile_name FROM `user` INNER JOIN `profile` ON `profile`.user_idx = `user`.idx;
const innerJoinQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['id', 'name'],
    fieldAs: {
        'profile.name': 'profile_name'
    },
    leftJoin: [
        {
            table: 'profile',
            on: '`profile`.user_idx = `user`.idx'
        }
    ]
});
```

## GROUP BY
```ts
// SELECT * FROM `user` GROUP BY id, adult_yn;
const groupByQuery = await dbqb.selectQuery({
    table: 'user',
    groupBy: ['id', 'adult_yn']
});
```

## SET
```ts
// UPDATE `user` SET login_date = '2000-11-01', login_count = login_count + 1 WHERE idx = 1;
// `+=`, `-=`
const setQuery = await dbqb.updateQuery({
    table: 'user',
    set: {
        login_date: '2000-11-01',
        'login_count +=': 1
    },
    where: {
        idx: 1
    }
});
```

## ORDER BY
```ts
// SELECT * FROM `user` WHERE nick LIKE 'test%' ORDER BY login_date DESC, idx ASC;
const orderQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        'nick %': 'test%'
    },
    orderBy: [
        ['login_date', 'DESC'],
        ['idx', 'DESC'],
    ]
});

// SELECT * FROM `user` WHERE nick LIKE 'test%' ORDER BY login_date DESC, idx ASC;
const orderQuery2 = await dbqb.selectQuery({
    table: 'user',
    where: {
        'nick %': 'test%'
    },
    orderBy: {
        login_date: 'DESC',
        idx: 'ASC'
    }
});
```

## INDEX
```ts
// SELECT * FROM `user` USE INDEX (id_index) WHERE id = 'test';
const indexQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        id: 'test'
    },
    useIndex: 'id_index'
});
```
