import DBQB from '../dist/index.mjs';

const dbqb = new DBQB({
    getTables: () => {
        return [
            'user',
            'profile',
            'board'
        ];
    },
    getFields: (table) => {
        switch (table) {
            case 'user':
                return [
                    { Field: 'idx', Type: 'int' },
                    { Field: 'email', Type: 'varchar(32)' },
                    { Field: 'password', Type: 'varchar(255)' },
                    { Field: 'auth_yn', Type: "enum('Y','N')" },
                    { Field: 'name', Type: 'varchar(32)' },
                    { Field: 'phone', Type: 'varchar(32)' },
                    { Field: 'join_at', Type: 'datetime' },
                    { Field: 'login_at', Type: 'datetime' },
                    { Field: 'login_count', Type: 'int' },
                ];
            case 'profile':
                return [
                    { Field: 'idx', Type: 'int' },
                    { Field: 'user_idx', Type: 'int' },
                    { Field: 'nick', Type: 'varchar(32)' },
                    { Field: 'sns_url', Type: 'varchar(255)' },
                ];
            case 'board':
                return [
                    { Field: 'idx', Type: 'int' },
                    { Field: 'user_idx', Type: 'int' },
                    { Field: 'title', Type: 'varchar(32)' },
                    { Field: 'content', Type: 'text' },
                    { Field: 'json', Type: 'json' },
                    { Field: 'create_at', Type: 'datetime' },
                ]
                break;
            default:
                return null;
        }
    }
});

const selectQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        email: 'test@gmail.com'
    }
});
console.log(`selectQuery : ${selectQuery}`);

const countQuery = await dbqb.countQuery({
    table: 'user',
    where: {
        auth_yn: 'Y'
    }
});
console.log(`countQuery : ${countQuery}`);

const insertQuery = await dbqb.insertQuery({
    table: 'profile',
    data: {
        user_idx: 1,
        nick: 'test',
        sns_url: 'https://www.youtube.com/c/test'
    }
});
console.log(`insertQuery : ${insertQuery}`);

const insertAllQuery = await dbqb.insertAllQuery({
    table: 'profile',
    data: [
        {
            user_idx: 1,
            nick: 'test',
            sns_url: 'https://www.youtube.com/c/test'
        },
        {
            user_idx: 2,
            nick: 'hello',
        },
        {
            user_idx: 2,
            nick: 'hello',
            sns_url: null
        }
    ]
});
console.log(`insertAllQuery : ${insertAllQuery}`);

const updateQuery = await dbqb.updateQuery({
    table: 'user',
    set: {
        email: 'test@daum.net'
    },
    where: {
        idx: 3
    }
});
console.log(`updateQuery : ${updateQuery}`);

const insertUpdateQuery = await dbqb.insertUpdateQuery({
    table: 'profile',
    data: {
        user_idx: 1,
        nick: 'test',
        sns_url: 'https://www.youtube.com/c/test'
    },
    set: {
        nick: 'test'
    }
});
console.log(`insertUpdateQuery : ${insertUpdateQuery}`);

const deleteQuery = await dbqb.deleteQuery({
    table: 'user',
    where: {
        email: 'test@gmail.com'
    }
});
console.log(`deleteQuery : ${deleteQuery}`);

const selectWhereQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        email: 'test@gmail.com',
        'idx !=': 3,
        'join_at >=': '2022-01-01 00:00:00',
        login_at: null,
        'password !=': null,
        name: ['test', 'test2'],
        'name !=': ['abc', 'xyz'],
        'phone %': '010123%',
        'phone !%': '1234%',
        [Symbol('OR')]: {
            auth_yn: 'Y',
            name: 'test',
            [Symbol('AND')]: {
                idx: 2,
                phone: '010'
            }
        }
    }
});
console.log(`selectWhereQuery : ${selectWhereQuery}`);

const selectWhereOrQuery = await dbqb.selectQuery({
    table: 'profile',
    whereOr: {
        nick: '123',
        idx: 3
    }
});
console.log(`selectWhereOrQuery : ${selectWhereOrQuery}`);

// SQL Injection 주의
const selectSWhereQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        auth_yn: 'Y'
    },
    sWhere: 'AND name != "test" AND (phone = "123" OR email = "321")'
});
console.log(`selectSWhereQuery : ${selectSWhereQuery}`);

// SQL Injection 주의
const bangQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        email: 'test@test.com',
        '!join_at': 'user.login_at',
        '!phone': '"phone"',
        '!idx': `(${await dbqb.selectQuery({
            table: 'profile',
            field: ['user_idx'],
            where: {
                'nick %': 'test%'
            }
        })})`
    }
});
console.log(`bangQuery : ${bangQuery}`);

// SQL Injection 주의
const havingQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['auth_yn'],
    fieldAs: {
        'COUNT(1)': 'count'
    },
    having: {
        '!count >=': 10
    }
});
console.log(`havingQuery : ${havingQuery}`);

const limitQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        auth_yn: 'Y'
    },
    offset: 0,
    limit: 10
});
console.log(`limitQuery : ${limitQuery}`);

const fieldQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['*', 'email', 'password'],
    fieldAs: {
        name: 'user_name',
        'SUM(login_count)': 'idx_sum'
    }
});
console.log(`fieldQuery : ${fieldQuery}`);

const fieldQuery2 = await dbqb.selectQuery({
    table: 'user',
    fieldAs: {
        '!COUNT(IF(auth_yn = "Y", 1, NULL)': 'auth_count'
    }
});
console.log(`fieldQuery2 : ${fieldQuery2}`);

const leftJoinQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['*'],
    fieldAs: {
        'profile.nick': 'nick'
    },
    leftJoin: [
        {
            table: 'profile',
            on: '`profile`.user_idx = `user`.idx'
        }
    ],
    where: {
        email: 'test@test.com'
    }
});
console.log(`leftJoinQuery : ${leftJoinQuery}`);

const innerJoinQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['email', 'name'],
    fieldAs: {
        'profile.nick': 'profile_name'
    },
    leftJoin: [
        {
            table: 'profile',
            on: '`profile`.user_idx = `user`.idx'
        }
    ],
    where: {
        'profile.nick %': 'test%'
    }
});
console.log(`innerJoinQuery : ${innerJoinQuery}`);

const groupByQuery = await dbqb.selectQuery({
    table: 'user',
    groupBy: ['name', 'auth_yn']
});
console.log(`groupByQuery : ${groupByQuery}`);

const setQuery = await dbqb.updateQuery({
    table: 'user',
    set: {
        login_at: '2000-11-01 00:00:00',
        'login_count +=': 1
    },
    where: {
        idx: 1
    }
});
console.log(`setQuery : ${setQuery}`);

const orderQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        'name %': 'test%'
    },
    orderBy: [
        ['login_at', 'DESC'],
        ['login_at', 'DESC'],
        ['idx', 'ASC'],
    ]
});
console.log(`orderQuery : ${orderQuery}`);

// SQL Injection 주의
const indexQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        email: 'test'
    },
    useIndex: 'email_index'
});
console.log(`indexQuery : ${indexQuery}`);

if (dbqb.getErrorLogs().length > 0) {
    console.error('error', dbqb.getErrorLogs());
} else {
    console.log('SUCCESS');
}
