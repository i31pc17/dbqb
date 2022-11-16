import {Sequelize, QueryTypes, Transaction} from 'sequelize';
import _ from 'lodash';
import DBQB, {IActive, IFieldItem} from "./index";

export interface ISelectPage {
    offset: number;
    limit: number;
    total: number;
    page: number;
    lastPage: number;
}

export interface IActiveSelect extends IActive {
    func?: (item: any, active: IActive) => any;
    selectType?: string;
    selectKey?: string;
}

const getResultArray = (aList: any, type = '', key = '') => {
    if (type === 'array') {
        const aList2: any = key ? [] : {};
        _.forEach(aList, (items) => {
            if (key) {
                if (items[key]) {
                    aList2.push(items[key]);
                }
            } else {
                _.forEach(items, (item, itemKey) => {
                    if (!aList2[itemKey]) {
                        aList2[itemKey] = [];
                    }
                    aList2[itemKey].push(item);
                });
            }
        });
        return aList2;
    } else if (type === 'key' && key) {
        const aList2: any = {};
        const _ex = _.split(key, '.');
        const _key1 = _.get(_ex, 0, '');
        const _key2 = _.get(_ex, 1, '');

        _.forEach(aList, (items) => {
            if (_key1 && _key2) {
                aList2[items[_key1]] = items[_key2];
            } else {
                aList2[items[key]] = items;
            }
        });
        return aList2;
    } else if (type === 'akey' && key) {
        const aList2: any = {};
        const _ex = _.split(key, '.');
        const _key1 = _.get(_ex, 0, '');
        const _key2 = _.get(_ex, 1, '');
        _.forEach(aList, (items) => {
            if (_key1 && _key2) {
                if (!_.has(aList2, items[_key1])) {
                    aList2[items[_key1]] = {};
                }
                _.set(aList2, `${items[_key1]}.${items[_key2]}`, items);
            } else {
                if (!aList2[items[key]]) {
                    aList2[items[key]] = [];
                }
                aList2[items[key]].push(items);
            }
        });
        return aList2;
    }
    return aList;
};

export const selectMap = (index: any, active: IActiveSelect, type: string, func: (item: any) => any) => {
    let result: any = [];
    if (type === 'page') {
        if (typeof func === 'function' && index.page.total > 0 && index.contents && index.contents.length > 0) {
            result = index.contents.map(func);
        }
    } else if (type === 'all') {
        if (typeof func === 'function' && _.size(index) > 0) {
            _.map(index, (items) => {
                if (active.selectType === 'akey') {
                    result = [...result, ...items.map(func)];
                } else {
                    result.push(func(items));
                }
            });
        }
    } else if (type === 'row') {
        if (typeof func === 'function' && index) {
            result = [func(index)];
        }
    }
    if (result.length > 0 && result[0] && typeof result[0].then === 'function') {
        result = Promise.all(result);
    }
    return result;
}

class SequelizeDB {
    public readonly sequelize: Sequelize;
    private dbqb: DBQB;
    private fn: (item: any, key: string) => void | null = null;

    constructor(sequelize: Sequelize) {
        this.sequelize = sequelize;
        this.dbqb = new DBQB(this);
    }

    public async getTables() {
        return await this.sequelize.query('SHOW TABLES', {
            type: QueryTypes.SHOWTABLES
        });
    }

    public async getFields(table: string) {
        return <IFieldItem[]>await this.sequelize.query(`SHOW FIELDS FROM ${table}`, {
            type: QueryTypes.SELECT,
            raw: true
        });
    }

    public validate(fn: (item: any, key: string) => void) {
        this.fn = fn;
    }

    public async selectQuery(active: IActive) {
        return this.dbqb.selectQuery(active);
    }

    public async countQuery(active: IActive) {
        return this.dbqb.countQuery(active);
    }

    public async queryRow(query: string, t: Transaction | null = null) {
        const index = await this.sequelize.query(query, {
            type: QueryTypes.SELECT,
            raw: true,
            transaction: t
        });

        if (_.size(index) === 0) {
            return null;
        }
        const row = index[0];

        if (this.fn) {
            _.forEach(row, (val: any, key: string) => {
                row[key] = this.fn(val, key);
            });
        }

        return row;
    }

    public async queryAll(query: string, type = '', key = '', t: Transaction | null = null) {
        const index = await this.sequelize.query(query, {
            type: QueryTypes.SELECT,
            raw: true,
            transaction: t
        });

        if (_.size(index) === 0) {
            return null;
        }

        if (this.fn) {
            _.forEach(index, (items, idx: number) => {
                _.forEach(items, (item: any, key: string) => {
                    index[idx][key] = this.fn(item, key);
                });
            });
        }
        return getResultArray(index, type, key);
    }

    public async queryOne(query: string, t: Transaction | null = null) {
        const index = await this.sequelize.query(query, {
            type: QueryTypes.SELECT,
            raw: true,
            transaction: t
        });

        if (_.size(index) === 0) {
            return null;
        }

        const keys = Object.keys(index[0]);

        return index[0][keys[0]];
    }

    public async selectRow(active: IActive, t: Transaction | null = null) {
        active.limit = 1;
        const sQuery = await this.dbqb.selectQuery(active);
        if (!sQuery) {
            return null;
        }
        return this.queryRow(sQuery, t);
    }

    public async selectAll(active: IActive, type = '', key = '', t: Transaction | null = null) {
        if (!_.get(active, 'nolimit')) {
            _.set(active, 'offset', _.get(active, 'offset', 0));
            _.set(active, 'limit', _.get(active, 'limit', 1));
        }
        const sQuery = await this.dbqb.selectQuery(active);
        if (!sQuery) {
            return null;
        }
        return this.queryAll(sQuery, type, key, t);
    }

    public async selectOne(active: IActive, t: Transaction | null = null) {
        active.limit = 1;
        const sQuery = await this.dbqb.selectQuery(active);
        if (!sQuery) {
            return null;
        }
        return this.queryOne(sQuery, t);
    }

    public async selectPage(active: IActive & {query?: string, queryCnt?: string}, t: Transaction | null = null) {
        if (!_.get(active, 'nolimit')) {
            _.set(active, 'offset', _.get(active, 'offset', 0));
            _.set(active, 'limit', _.get(active, 'limit', 20));
        }

        let sQuery = '';
        let sQueryCnt = '';
        if (_.get(active, 'query') && _.get(active, 'queryCnt')) {
            sQuery = active.query;
            sQueryCnt = active.queryCnt;

            if (!_.get(active, 'nolimit')) {
                sQuery += ` LIMIT ${active.offset}, ${active.limit}`;
            }
        } else {
            sQuery = await this.dbqb.selectQuery(active);
            if ((_.get(active, 'having') && _.size(active.having) > 0) || (_.get(active, 'havingOr') && _.size(active.havingOr) > 0)) {
                const activeCnt = { ...active };
                _.unset(activeCnt, 'limit');
                _.unset(activeCnt, 'offset');
                const sQuery2 = await this.dbqb.selectQuery(activeCnt);
                sQueryCnt = `SELECT COUNT(1) FROM ( ${sQuery2} ) AS cnt`;
            } else {
                sQueryCnt = await this.dbqb.countQuery(active);
            }
        }

        const aReturn: {page: ISelectPage, contents: any} = {} as any;
        if (sQuery && sQueryCnt) {
            const aContents = await this.queryAll(sQuery, '', '', t);
            let nCount = _.toNumber(await this.queryOne(sQueryCnt, t));
            if (_.isNaN(nCount)) {
                nCount = 0;
            }

            const page: ISelectPage = {
                offset: 0,
                limit: 0,
                total: 0,
                page: 1,
                lastPage: 1
            };
            if (_.get(active, 'nolimit')) {
                page.offset = 0;
                page.limit = nCount;
                page.total = nCount;
                page.page = 1;
                page.lastPage = 1;
            } else {
                page.offset = _.toNumber(active.offset);
                page.limit = _.toNumber(active.limit);
                page.total = nCount;
                page.page = Math.floor(page.offset / page.limit) + 1;
                page.lastPage = Math.ceil(page.total / page.limit);
            }
            const nContentCnt = _.size(aContents);
            if (nContentCnt > 0 && nContentCnt > page.total) {
                page.total = nContentCnt;
            }

            aReturn.page = page;
            aReturn.contents = aContents;
        } else {
            aReturn.page = {
                offset: 0, limit: 0, total: 0, page: 1, lastPage: 1
            };
            aReturn.contents = null;
        }
        return aReturn;
    }

    public async select(_active: IActiveSelect, type = 'page', func: (item: any, active: IActive) => any | null = null, t: Transaction | null = null) {
        const active = { ..._active };
        if (_.get(active, 'func')) {
            func = active.func;
        }
        let index: any = [];
        let promise = [];
        if (type === 'page') {
            index = await this.selectPage(active, t);
            if (index && _.isArray(index.contents) && _.size(index.contents) > 0 && typeof func === 'function') {
                promise = _.map(index.contents, (item) => func(item, active));
            }
        } else if (type === 'all') {
            const selectType: string = _.get(active, 'selectType', '');
            const selectKey: string = _.get(active, 'selectKey', '');
            _.unset(active, 'selectType');
            _.unset(active, 'selectKey');
            index = await this.selectAll(active, selectType, selectKey, t);
            if (index && _.size(index) > 0 && typeof func === 'function' && _.includes(['', 'key', 'akey'], selectType)) {
                _.map(index, (items) => {
                    if (selectType === 'akey') {
                        promise = [...promise, ..._.map(items, (item) => func(item, active))];
                    } else {
                        promise.push(func(items, active));
                    }
                });
            }
        } else if (type === 'row') {
            index = await this.selectRow(active, t);
            if (index && typeof func === 'function') {
                promise.push(func(index, active));
            }
        }

        // promise 예외처리
        if (_.size(promise) > 0 && promise[0] && typeof promise[0].then === 'function') {
            await Promise.all(promise);
        }

        return index;
    }

    public async insert(active: IActive, t: Transaction | null = null) {
        const query = await this.dbqb.insertQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        const index = await this.sequelize.query(query, {
            type: QueryTypes.INSERT,
            raw: true,
            transaction: t
        });

        return {
            result: true,
            insertId: index[0]
        };
    }

    public async insertAll(active: IActive, t: Transaction | null = null) {
        const query = await this.dbqb.insertAllQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        const index = await this.sequelize.query(query, {
            type: QueryTypes.INSERT,
            raw: true,
            transaction: t
        });

        let priKey: string | null = null;
        const _tField = await this.getFields(active.table);
        _.forEach(_tField, (_item) => {
            if (_item.Key === 'PRI' && _item.Extra === 'auto_increment') {
                priKey = _item.Field;
                return false;
            }
        });

        let insertIds = [];
        if (priKey) {
            const insertId = index[0];
            const nDataCnt = _.size(active.data);

            insertIds = await this.selectAll({
                table: active.table,
                field: [priKey],
                where: {
                    [`${priKey} >=`]: insertId
                },
                limit: nDataCnt,
                orderBy: {
                    [`${priKey} >=`]: 'ASC'
                }
            }, 'array', priKey, t);
        }

        return {
            result: true,
            insertId: insertIds
        };
    }

    public async update(active: IActive, t: Transaction | null = null) {
        const query = await this.dbqb.updateQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        const index = await this.sequelize.query(query, {
            type: QueryTypes.UPDATE,
            raw: true,
            transaction: t
        });

        return {
            result: true,
            affected: index[1]
        };
    }

    public async insertUpdate(active: IActive, t: Transaction | null = null) {
        const query = await this.dbqb.insertUpdateQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        await this.sequelize.query(query, {
            type: QueryTypes.INSERT,
            raw: true,
            transaction: t
        });

        return {
            result: true
        };
    }

    public async delete(active: IActive, t: Transaction | null = null) {
        const query = await this.dbqb.deleteQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        await this.sequelize.query(query, {
            type: QueryTypes.DELETE,
            raw: true,
            transaction: t
        });

        return {
            result: true
        };
    }

    public getErrorLogs() {
        return this.dbqb.getErrorLogs();
    }
}


export { SequelizeDB }
