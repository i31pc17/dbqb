import {QueryOptions, QueryTypes, Sequelize, Transaction, QueryOptionsWithType} from 'sequelize';
import _ from 'lodash';
import DBQB, {IActive, IFieldItem} from "./index";

export interface ISelectPage {
    offset: number;
    limit: number;
    total: number;
    page: number;
    lastPage: number;
}

export interface ISelectPageResult<T = any> {
    contents: T[] | null;
    page: ISelectPage;
}

export type TSelectFn<T> = (item: T, active: IActive) => Promise<void> | void;

export type TQueryOptions = Transaction | QueryOptions | null;

export type TSelectTypes  = 'row' | 'all' | 'page';

export interface ISelectActive<T = any> extends IActive {
    func?: TSelectFn<T>;
    nolimit?: boolean;
    query?: string;
    queryCnt?: string
}

export const selectMap = <T, TResult = any>(index: any, type: TSelectTypes, func: (item: T) => TResult): TResult[] => {
    let result: any = [];
    if (type === 'page') {
        if (typeof func === 'function' && index.page.total > 0 && index.contents && index.contents.length > 0) {
            result = index.contents.map(func);
        }
    } else if (type === 'all') {
        if (typeof func === 'function' && _.size(index) > 0) {
            _.map(index, (items) => {
                result.push(func(items));
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
    private fn: ((item: any, key: string) => void) | null = null;

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

    private queryOptions(t: TQueryOptions = null) {
        let options: QueryOptions = {
            raw: true
        };
        if (t instanceof Transaction) {
            options.transaction = t;
        } else if (t) {
            options = {
                ...options,
                ...t
            }
        }
        return options;
    }

    public async transaction(t: TQueryOptions = null): Promise<[Transaction, TQueryOptions, boolean]> {
        if (t instanceof Transaction) {
            return [t, t, false];
        } else if (t) {
            const opt: QueryOptions = {
                ...t,
            };
            let gen = false;
            if (!opt.transaction) {
                opt.transaction = await this.sequelize.transaction();
                gen = true;
            }
            return [opt.transaction, opt, gen];
        } else {
            const trans = await this.sequelize.transaction();
            return [trans, trans, true];
        }
    }

    public setQueryOptions(t: TQueryOptions, qo: QueryOptions): TQueryOptions {
        if (t instanceof Transaction) {
            return {
                ...qo,
                transaction: t
            }
        } else if (t) {
            return {
                ...t,
                ...qo
            };
        }
        return null;
    }

    public async queryRow<T = any>(query: string, t: TQueryOptions = null): Promise<T | null> {
        const selectOption: QueryOptionsWithType<QueryTypes.SELECT> = this.queryOptions(t) as any;
        selectOption.type = QueryTypes.SELECT;
        const index: T[] = await this.sequelize.query<any>(query, selectOption);

        if (_.size(index) === 0) {
            return null;
        }
        const row = index[0];

        if (this.fn) {
            _.forEach<any>(row, (val: any, key: string) => {
                if (this.fn) {
                    _.set<any>(row, key, this.fn(val, key));
                }
            });
        }

        return row;
    }

    public async queryAll<T = any>(query: string, t: TQueryOptions = null): Promise<T[] | null> {
        const selectOption: QueryOptionsWithType<QueryTypes.SELECT> = this.queryOptions(t) as any;
        selectOption.type = QueryTypes.SELECT;
        const index: T[] =  await this.sequelize.query<any>(query, selectOption);

        if (_.size(index) === 0) {
            return null;
        }

        if (this.fn) {
            _.forEach(index, (items, idx: number) => {
                _.forEach<any>(items, (item: any, key: string) => {
                    if (this.fn) {
                        _.set<any>(index, `${idx}.${key}`, this.fn(item, key));
                    }
                });
            });
        }
        return index;
    }

    public async queryOne<T = any>(query: string, t: TQueryOptions = null): Promise<T | null> {
        const selectOption: QueryOptionsWithType<QueryTypes.SELECT> = this.queryOptions(t) as any;
        selectOption.type = QueryTypes.SELECT;
        const index: T[] =  await this.sequelize.query<any>(query, selectOption);

        if (_.size(index) === 0) {
            return null;
        }

        const keys = _.keys(index[0]);
        return _.get(index, `0.${keys[0]}`) as T;
    }

    public async selectRow<T = any>(active: ISelectActive, t: TQueryOptions = null): Promise<T | null> {
        active.limit = 1;
        const sQuery = await this.dbqb.selectQuery(active);
        if (!sQuery) {
            return null;
        }
        return this.queryRow<T>(sQuery, t);
    }

    public async selectAll<T = any>(active: ISelectActive, t: TQueryOptions = null): Promise<T[] | null> {
        if (!active.nolimit) {

            _.set(active, 'offset', _.get(active, 'offset', 0));
            _.set(active, 'limit', _.get(active, 'limit', 1));
        }
        const sQuery = await this.dbqb.selectQuery(active);
        if (!sQuery) {
            return null;
        }
        return this.queryAll<T>(sQuery, t);
    }

    public async selectOne<T = any>(active: ISelectActive, t: TQueryOptions = null): Promise<T | null> {
        active.limit = 1;
        const sQuery = await this.dbqb.selectQuery(active);
        if (!sQuery) {
            return null;
        }
        return this.queryOne<T>(sQuery, t);
    }

    public async selectPage<T = any>(active: ISelectActive, t: TQueryOptions = null) {
        if (!active.nolimit) {
            active.offset = _.get(active, 'offset', 0);
            active.limit = _.get(active, 'limit', 20);
        }

        let sQuery: string | null = '';
        let sQueryCnt: string | null = '';
        if (active.query && active.queryCnt) {
            sQuery = active.query;
            sQueryCnt = active.queryCnt;

            if (!_.get(active, 'nolimit')) {
                sQuery += ` LIMIT ${active.offset}, ${active.limit}`;
            }
        } else {
            sQuery = await this.dbqb.selectQuery(active);
            if ((active.having && _.size(active.having) > 0) || (active.havingOr && _.size(active.havingOr) > 0)) {
                const activeCnt = { ...active };
                _.unset(activeCnt, 'limit');
                _.unset(activeCnt, 'offset');
                const sQuery2 = await this.dbqb.selectQuery(activeCnt);
                sQueryCnt = `SELECT COUNT(1) FROM ( ${sQuery2} ) AS cnt`;
            } else {
                sQueryCnt = await this.dbqb.countQuery(active);
            }
        }

        const aReturn: ISelectPageResult<T> = {} as any;
        if (sQuery && sQueryCnt) {
            const aContents = await this.queryAll<T>(sQuery, t);
            let nCount = _.toNumber(await this.queryOne<number>(sQueryCnt, t));
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
            if (active.nolimit) {
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

    public async select<T = any>(_active: ISelectActive<T>, type?: 'page', func?: TSelectFn<T> | null, t?: TQueryOptions): Promise<ISelectPageResult<T> | null>;
    public async select<T = any>(_active: ISelectActive<T>, type: 'all', func?: TSelectFn<T> | null, t?: TQueryOptions): Promise<T[] | null>;
    public async select<T = any>(_active: ISelectActive<T>, type: 'row', func?: TSelectFn<T> | null, t?: TQueryOptions): Promise<T | null>;
    public async select<T = any>(_active: ISelectActive<T>, type: TSelectTypes, func?: TSelectFn<T> | null, t?: TQueryOptions): Promise<T | T[] | ISelectPageResult<T> | null>;
    public async select<T = any>(_active: ISelectActive<T>, type: TSelectTypes = 'page', func?: TSelectFn<T> | null, t?: TQueryOptions): Promise<T | T[] | ISelectPageResult<T> | null> {
        const active = { ..._active };
        if (_.get(active, 'func')) {
            func = active.func;
        }
        let promise: any[] = [];
        let index: any = null;
        if (type === 'page') {
            const pageIndex = await this.selectPage<T>(active, t);
            if (pageIndex && _.isArray(pageIndex.contents) && _.size(pageIndex.contents) > 0 && typeof func === 'function') {
                promise = _.map(pageIndex.contents, (item) => {
                    if (func) {
                        func(item, active);
                    }
                });
            }
            index = pageIndex;
        } else if (type === 'all') {
            const allIndex = await this.selectAll<T>(active, t);
            if (allIndex && _.size(allIndex) > 0 && typeof func === 'function') {
                _.map(allIndex, (items) => {
                    if (func) {
                        promise.push(func(items, active));
                    }
                });
            }
            index = allIndex;
        } else if (type === 'row') {
            const rowIndex = await this.selectRow<T>(active, t);
            if (rowIndex && typeof func === 'function') {
                promise.push(func(rowIndex, active));
            }
            index = rowIndex;
        }

        // promise 예외처리
        if (_.size(promise) > 0 && promise[0] && typeof promise[0].then === 'function') {
            await Promise.all(promise);
        }

        return index;
    }

    public async insert(active: IActive, t: TQueryOptions = null) {
        const query = await this.dbqb.insertQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        const insertOption: QueryOptionsWithType<QueryTypes.INSERT> = this.queryOptions(t) as any;
        insertOption.type = QueryTypes.INSERT;

        const index = await this.sequelize.query(query, insertOption);

        return {
            result: true,
            insertId: index[0]
        };
    }

    public async insertAll(active: IActive, t: TQueryOptions = null) {
        const query = await this.dbqb.insertAllQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        if (!active.table) {
            return;
        }

        const insertOption: QueryOptionsWithType<QueryTypes.INSERT> = this.queryOptions(t) as any;
        insertOption.type = QueryTypes.INSERT;
        const index = await this.sequelize.query(query, insertOption);

        let priKey: string | null = null;
        const _tField = await this.getFields(active.table);
        for (const _item of _tField) {
            if (_item.Key === 'PRI' && _item.Extra === 'auto_increment') {
                priKey = _item.Field;
                break;
            }
        }

        let insertIds: number[] = [];
        if (priKey) {
            const insertId = index[0];
            const nDataCnt = _.size(active.data);

            const _idxs = await this.selectAll({
                table: active.table,
                field: [priKey],
                where: {
                    [`${priKey} >=`]: insertId
                },
                limit: nDataCnt,
                orderBy: {
                    [`${priKey} >=`]: 'ASC'
                }
            }, t);

            insertIds = _.map(_idxs, (id) => id[priKey!]);
        }

        return {
            result: true,
            insertId: insertIds
        };
    }

    public async update(active: IActive, t: TQueryOptions = null) {
        const query = await this.dbqb.updateQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        const updateOption: QueryOptionsWithType<QueryTypes.UPDATE> = this.queryOptions(t) as any;
        updateOption.type = QueryTypes.UPDATE;
        const index = await this.sequelize.query(query, updateOption);

        return {
            result: true,
            affected: index[1]
        };
    }

    public async insertUpdate(active: IActive, t: TQueryOptions = null) {
        const query = await this.dbqb.insertUpdateQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        const insertOption: QueryOptionsWithType<QueryTypes.INSERT> = this.queryOptions(t) as any;
        insertOption.type = QueryTypes.INSERT;
        await this.sequelize.query(query, insertOption);

        return {
            result: true
        };
    }

    public async delete(active: IActive, t: Transaction | null = null) {
        const query = await this.dbqb.deleteQuery(active);
        if (query === null || !query) {
            throw new Error('query builder error');
        }

        const deleteOption: QueryOptionsWithType<QueryTypes.DELETE> = this.queryOptions(t) as any;
        deleteOption.type = QueryTypes.DELETE;
        await this.sequelize.query(query, deleteOption);

        return {
            result: true
        };
    }

    public getErrorLogs() {
        return this.dbqb.getErrorLogs();
    }
}


export { SequelizeDB }
