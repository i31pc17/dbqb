import DBQB from '../dist/index.mjs';

const dbqb = new DBQB({
    getTables: () => {
        return [
            'user',
            'profile',
            'board',
            'bank',
        ];
    },
    getFields: (table) => {
        switch (table) {
            case 'user':
                return [
                    { Field: 'idx', Type: 'int', Null: 'NO', Key: 'PRI', Default: '', Extra: 'auto_increment' },
                    { Field: 'email', Type: 'varchar(32)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'password', Type: 'varchar(255)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'auth_yn', Type: "enum('Y','N')", Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'name', Type: 'varchar(32)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'phone', Type: 'varchar(32)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'join_at', Type: 'datetime', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'login_at', Type: 'datetime', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'login_count', Type: 'int', Null: 'NO', Key: '', Default: '', Extra: '' },
                ];
            case 'profile':
                return [
                    { Field: 'idx', Type: 'int', Null: 'NO', Key: 'PRI', Default: '', Extra: 'auto_increment' },
                    { Field: 'user_idx', Type: 'int', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'nick', Type: 'varchar(32)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'sns_url', Type: 'varchar(255)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'json', Type: 'json', Null: 'NO', Key: '', Default: '', Extra: '' },
                ];
            case 'board':
                return [
                    { Field: 'idx', Type: 'int', Null: 'NO', Key: 'PRI', Default: '', Extra: 'auto_increment' },
                    { Field: 'user_idx', Type: 'int', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'title', Type: 'varchar(32)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'content', Type: 'text', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'create_at', Type: 'datetime', Null: 'NO', Key: '', Default: '', Extra: '' },
                ]
                break;
            case 'bank':
                return [
                    { Field: 'idx', Type: 'int', Null: 'NO', Key: 'PRI', Default: '', Extra: 'auto_increment' },
                    { Field: 'user_idx', Type: 'int', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'bank_code', Type: 'varchar(10)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'bank_name', Type: 'varchar(50)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'bank_account_num', Type: 'varchar(50)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'bank_account_name', Type: 'varchar(50)', Null: 'NO', Key: '', Default: '', Extra: '' },
                    { Field: 'create_at', Type: 'datetime', Null: 'NO', Key: '', Default: '', Extra: '' },
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
        sns_url: 'https://www.youtube.com/c/test',
        json: {
            a: 'aa', b: 2, c: ['c', 'd']
        }
    }
});
console.log(`insertQuery : ${insertQuery}`);

const insertAllQuery = await dbqb.insertAllQuery({
    table: 'profile',
    data: [
        {
            user_idx: 1,
            nick: 'test',
            sns_url: 'https://www.youtube.com/c/test',
            json: ['1', '2', {a: 'b', c: 'd'}]
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
        email: 'test@daum.net',
        phone: null
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
        'join_at <=>': ['2022-01-01 00:00:00', '2022-01-01 23:59:59'],
        'join_at <!=>': ['2022-01-01 00:00:00', '2022-01-01 23:59:59'],
        login_at: null,
        join_at: Symbol('login_at'),
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
        },
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

const havingQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['auth_yn'],
    fieldAs: {
        'COUNT(1)': 'count'
    },
    having: {
        'count >=': 10,
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
        'SUM(login_count)': 'idx_sum',
        [Symbol('name')]: 'user_name2',
        [Symbol('user.name')]: 'user_name3',
    }
});
console.log(`fieldQuery : ${fieldQuery}`);

const fieldQuery2 = await dbqb.selectQuery({
    table: 'user',
    fieldAs: {
        '!COUNT(IF(auth_yn = "Y", 1, NULL)': 'auth_count',
        '!0': 'count',
        [Symbol('!7')]: 'count2',
        [Symbol('!"test"')]: 'message',
    }
});
console.log(`fieldQuery2 : ${fieldQuery2}`);

const fieldQuery3 = await dbqb.selectQuery({
    table: 'user',
    fieldAs: {
        '!(SELECT `profile_parent`.`sns_url` FROM `profile` AS `profile_parent` WHERE `profile_parent`.`user_idx` = `user`.`idx` AND `profile_parent`.`nick` = `bankAs`.`bank_name` LIMIT 1)': 'profile_sns_url'
    },
    fieldQueryAs: [
        [{
            table: 'profile',
            as: 'profile_parent',
            field: ['sns_url'],
            where: {
                user_idx: Symbol('user.idx'),
                nick: Symbol('bank.bank_name')
            },
        }, 'profile_sns_url2']
    ],
    innerJoin: [
        {
            table: 'bank',
            as: 'bankAs',
            on: {
                user_idx: Symbol('user.idx')
            }
        }
    ]
});
console.log(`fieldQuery3 : ${fieldQuery3}`);

const leftJoinQuery = await dbqb.selectQuery({
    table: 'board',
    field: ['*'],
    fieldAs: {
        'u.email': 'email',
        'p.nick': 'nick'
    },
    leftJoin: [
        {
            table: 'user',
            as: 'u',
            on: 'board.user_idx'
        },
        {
            table: 'user',
            as: 'u',
            on: Symbol('board.user_idx')
        },
        {
            table: 'profile',
            as: 'p',
            on: {
                user_idx: Symbol('board.user_idx')
            }
        }
    ],
    where: {
        'u.email': 'test@test.com'
    }
});
console.log(`leftJoinQuery : ${leftJoinQuery}`);

const innerJoinQuery = await dbqb.selectQuery({
    table: 'user',
    field: ['email', 'name'],
    fieldAs: {
        'profile.nick': 'profile_name'
    },
    innerJoin: [
        {
            table: 'profile',
            on: '`profile`.user_idx = `user`.idx'
        },
        {
            table: 'board',
            on: 'user.idx'
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
    // forceIndex, useIndex, ignoreIndex
    useIndex: 'email_index'
});
console.log(`indexQuery : ${indexQuery}`);

// sub query
const subQuery = await dbqb.selectQuery({
    table: 'user',
    as: 'parent',
    parentTables: [
        {table: 'board'},
        {table: 'profile', as: 'p'}
    ],
    field: [
        'COUNT(1)'
    ],
    where: {
        idx: Symbol('board.user_idx'),
        'idx !=': Symbol('p.user_idx')
    },
    limit: 1
});
console.log(`subQuery : ${subQuery}`);

// count query join
const countJoinQuery = await dbqb.countQuery({
    table: 'board',
    leftJoin: [
        {
            table: 'user',
            on: 'board.user_idx',
            innerJoin: [
                {
                    table: 'profile',
                    on: {
                        user_idx: Symbol('user.idx')
                    },
                }
            ],
            leftJoin: [
                {
                    table: 'bank',
                    on: {
                        user_idx: Symbol('board.user_idx')
                    }
                }
            ]
        }
    ],
});
console.log(`countJoinQuery : ${countJoinQuery}`);

// count query join
const countJoinQuery2 = await dbqb.countQuery({
    table: 'board',
    joins: [
        {
            table: 'user',
            on: 'board.user_idx',
            joins: [
                {
                    table: 'profile',
                    on: {
                        user_idx: Symbol('user.idx')
                    },
                },
            ]
        },
        {
            table: 'bank',
            on: {
                user_idx: Symbol('board.user_idx')
            }
        }
    ],
    where: {
        'profile.nick': 'nickname'
    }
});
console.log(`countJoinQuery2 : ${countJoinQuery2}`);

const countJoinQuery3 = await dbqb.countQuery({
    table: 'board',
    joins: [
        {
            table: 'user',
            on: 'board.user_idx',
            joins: [
                {
                    table: 'profile',
                    on: {
                        user_idx: Symbol('user.idx')
                    },
                    type: 'inner'
                },
                {
                    table: 'bank',
                    on: {
                        user_idx: Symbol('board.user_idx')
                    }
                }
            ],
        }
    ],
    where: {
        'user.auth_yn': 'Y'
    }
});
console.log(`countJoinQuery3 : ${countJoinQuery3}`);

const countJoinQuery4 = await dbqb.countQuery({
    table: 'board',
    joins: [
        {
            table: 'user',
            on: 'board.user_idx',
            joins: [
                {
                    table: 'profile',
                    on: {
                        user_idx: Symbol('user.idx')
                    },
                    type: 'inner'
                },
                {
                    table: 'bank',
                    on: {
                        user_idx: Symbol('board.user_idx')
                    },
                }
            ],
            clear: false
        }
    ],
    where: {
        'board.user_idx': 10
    }
});
console.log(`countJoinQuery4 : ${countJoinQuery4}`);

const countJoinQuery5 = await dbqb.countQuery({
    table: 'board',
    joins: [
        {
            table: 'user',
            on: 'board.user_idx',
            joins: [
                {
                    table: 'profile',
                    on: {
                        user_idx: Symbol('user.idx')
                    },
                    type: 'inner'
                },
                {
                    table: 'bank',
                    on: {
                        user_idx: Symbol('board.user_idx')
                    },
                }
            ],
            clear: false
        }
    ],
    where: {
        'content %': 'test'
    },
    groupBy: [
      'user_idx'
    ]
});
console.log(`countJoinQuery5 : ${countJoinQuery5}`);

const forUpdateQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        email: 'test@gmail.com'
    },
    forUpdate: true // true / nowait / skip
});
console.log(`forUpdateQuery : ${forUpdateQuery}`);

const partitionQuery = await dbqb.selectQuery({
    table: 'user',
    where: {
        email: 'test@gmail.com'
    },
    partition: ['p200101', 'p200102']
});
console.log(`partitionQuery : ${partitionQuery}`);

if (dbqb.getErrorLogs().length > 0) {
    console.error('error', dbqb.getErrorLogs());
} else {
    console.log('SUCCESS');
}
