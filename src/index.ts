import _ from 'lodash';

export interface IActive extends IActiveJoins{
    table: string;
    as?: string;
    field?: string[];
    fieldAs?: Record<string, string>;
    clearField?: {
        field?: string[];
        fieldAs?: Record<string, string>;
    };
    useIndex?: string;
    where?: any;
    whereOr?: any;
    sWhere?: string;
    groupBy?: string[];
    orderBy?: Record<string, 'ASC' | 'DESC'> | [string, 'ASC' | 'DESC'][];
    having?: any;
    havingOr?: any;
    offset?: number;
    limit?: number;
    data?: Record<string, any> | Record<string, any>[];
    set?: Record<string, any>;
    parentTables?: {table: string, as?: string}[];
}

export interface IFieldItem {
    Field: string;
    Type: string;
    Null: string;
    Key: string;
    Default: string;
    Extra: string;
}

export interface IDB {
    getTables: () => string[] | Promise<string[]>;
    getFields: (table: string) => IFieldItem[] | Promise<IFieldItem[]>;
}

interface IActivePrivate extends IActive {
    tableList: string[];
    tableAs: Record<string, string[]>;
    asTable: string[];
    tableField: Record<string, Record<string, IFieldItem>>;
}

interface IActiveInfo {
    table?: string;
    field?: string;
    useIndex?: string;
    join?: string;
    where?: string;
    groupBy?: string;
    having?: string;
    orderBy?: string;
    limit?: string;
    count?: string;
    data?: string;
    values?: string;
    set?: string;
}

export interface IActiveJoin extends IActiveJoins {
    table: string;
    on: any;
    as?: string;
    query?: string;
    clear?: boolean;
    type?: 'LEFT' | 'left' | 'INNER' | 'inner' | 'RIGHT' | 'right' | 'OUTER' | 'outer';
    // 내부용
    path?: string;
}

interface IActiveJoins {
    joins?: IActiveJoin[];
    innerJoin?: IActiveJoin[];
    leftJoin?: IActiveJoin[];
    rightJoin?: IActiveJoin[];
    outerJoin?: IActiveJoin[];
}

class DBQB {
    private db: IDB;
    private tables: null | string[] = null;
    private fields: Record<string, IFieldItem[]> = {};
    private joins = {
        innerJoin: 'INNER',
        leftJoin: 'LEFT',
        rightJoin: 'RIGHT',
        outerJoin: 'FULL OUTER',
    };
    private ifs = ['=', '+=', '-=', '!=', '>', '>=', '<', '<=', '%', '!%'];
    private errorLogs: string[] = [];
    constructor(db: IDB) {
        this.db = db;
    }

    private async checkTable(table: string) {
        if (this.tables === null) {
            this.tables = await this.db.getTables();
        }
        if (_.includes(this.tables, table)) {
            return true;
        }
        this.addErrorLogs(`checkTable: ${table}`);
        return false;
    }

    private async getFields(table: string) {
        if (!_.has(this.fields, table)) {
            this.fields[table] = await this.db.getFields(table);
        }
        return this.fields[table];
    }

    private getPKField(active: IActivePrivate, table: string) {
        let PK = '';
        const fields = _.get(active, `tableField.${table}`, []);
        _.forEach(fields, (field) => {
            if (field.Key === 'PRI' && field.Extra === 'auto_increment') {
                PK = field.Field;
                return false;
            }
        });
        return PK;
    }

    private addErrorLogs(error: string) {
        this.errorLogs.push(error);
        if (this.errorLogs.length > 50) {
            this.errorLogs.shift();
        }
    }

    public getErrorLogs() {
        return this.errorLogs;
    }

    private async initQuery(active: IActivePrivate) {
        // 테이블 체크
        if (!_.get(active, 'table')) {
            this.addErrorLogs('no table');
            return false;
        }

        // AS 변경용 미리 구하기
        active.tableList = [active.table];
        active.tableAs = {};
        active.asTable = [];
        if (_.get(active, 'as')) {
            active.asTable[active.as] = active.table;
            active.tableAs[active.table] = [active.as];
        }

        // join
        const joins = this.getJoins(active);
        active.joins = joins;
        _.forEach(joins, (join) => {
            if (join.table) {
                active.tableList.push(join.table);

                if (join.as) {
                    active.asTable[join.as] = join.table;
                    if (!active.tableAs[join.table]) {
                        active.tableAs[join.table] = [];
                    }
                    active.tableAs[join.table].push(join.as);
                }
            }
        });

        if (_.size(active.parentTables) > 0) {
            _.forEach(active.parentTables, (parentTable) => {
                active.tableList.push(parentTable.table);
                if (_.get(parentTable, 'as')) {
                    active.asTable[parentTable.as] = parentTable.table;
                    if (!active.tableAs[parentTable.table]) {
                        active.tableAs[parentTable.table] = [];
                    }
                    active.tableAs[parentTable.table].push(parentTable.as);
                }
            });
        }

        // 필드 예외처리
        if (_.get(active, 'clearField.field') || _.get(active, 'clearField.fieldAs')) {
            active.field = active.clearField.field;
            active.fieldAs = active.clearField.fieldAs;
        }

        // 전체 테이블 체크
        active.tableList = _.uniq(active.tableList);
        active.tableField = {};

        for (const _table of active.tableList) {
            if (!(await this.checkTable(_table))) {
                return false;
            }

            active.tableField[_table] = {};
            const field = await this.getFields(_table);
            if (field && _.size(field) > 0) {
                _.forEach(field, (_field) => {
                    active.tableField[_table][_field.Field] = _field;
                });
            }
        }

        return true;
    }

    private getFieldQuery(active: IActivePrivate) {
        let sTable = active.table;
        if (active.as) {
            sTable = active.as;
        }

        let sField = '';
        if (_.get(active, 'field') && _.size(active.field) > 0) {
            for (const val of active.field) {
                const aTFInfo = this.getTableField(active, val);
                if (aTFInfo === null) {
                    return null;
                }
                sField += `, ${aTFInfo.field}`;
            }
        }

        if (_.get(active, 'fieldAs') && _.size(active.fieldAs) > 0) {
            for (const key of _.keys(active.fieldAs)) {
                const val = active.fieldAs[key];
                const aTFInfo = this.getTableField(active, key);
                if (aTFInfo === null) {
                    return null;
                }
                sField += `, ${aTFInfo.field} AS `;
                if (aTFInfo.continue) {
                    sField += val;
                } else {
                    sField += `\`${val}\``;
                }
            }
        }

        if (sField.length === 0) {
            sField = `\`${sTable}\`.*`;
        } else {
            sField = sField.substring(1);
        }

        return sField;
    }

    private getTableField(active: IActivePrivate, field: string) {
        let realTable = active.table;
        let table = realTable;
        if (_.get(active, 'as')) {
            table = active.as;
        }
        field = _.trim(field);

        const returns = {
            continue: false,
            func: false,
            select: false,
            field: '',
            type: '',
            if: '=',
            realTable,
            realField: ''
        };

        // 조건문 추출
        const _exIf = _.split(field, ' ');
        if (_.size(_exIf) >= 2) {
            const _if = _exIf[_.size(_exIf) - 1];
            if (_.includes(this.ifs, _if)) {
                returns.if = _if;
                field = _.trim(field.substring(0, field.length - _if.length));
            }
        }

        // 프리패스
        if (_.startsWith(field, '!')) {
            returns.continue = true;
            field = field.substring(1);
            returns.field = field;
            return returns;
        }

        // 서브쿼리 예외처리
        if (this.pregMatch(field, /\(SELECT[^\)]+\)/i)) {
            returns.select = true;
            returns.field = field;
            return returns;
        }

        let fnField = '';
        let fnField2 = '';

        if (this.pregMatch(field, /[a-z]+\([^)]+\)/i)) {
            returns.func = true;
            fnField = field;
            fnField2 = this.checkFieldFn(field);
            field = fnField2;

            // COUNT(1) / COUNT(*) 예외처리
            if (_.includes(['1', '*'], field)) {
                returns.field = fnField;
                return returns;
            }
        }

        const _ex = _.split(field, '.');
        if (_.size(_ex) >= 2) {
            if (_.get(active, `tableAs.${_ex[0]}`) && _.size(active.tableAs[_ex[0]]) >= 1) {
                // `user` as `user` 예외처리
                if (!_.includes(active.tableAs[_ex[0]], _ex[0])) {
                    _ex[0] = active.tableAs[_ex[0]][0];
                }
            }

            table = _ex[0];
            field = _ex[1];

            if (_.get(active, `asTable.${table}`)) {
                realTable = active.asTable[table];
            } else {
                realTable = table;
            }

            returns.realTable = realTable;
        }

        // 테이블 체크
        if (!_.includes(active.tableList, realTable)) {
            this.addErrorLogs(`not table : ${table}`);
            return null;
        }

        returns.field = `\`${table}\`.`;
        if (_.includes(['*'], field)) {
            returns.field += field;
        } else {
            returns.field += `\`${field}\``;
            const chkType = _.get(active, `tableField.${realTable}.${field}.Type`);
            if (!chkType) {
                this.addErrorLogs(`not field : ${returns.field}`);
                return null;
            }
            returns.type = chkType;
        }

        if (returns.func) {
            returns.field = _.replace(fnField, fnField2, returns.field);
        }

        returns.realField = field;

        return returns;
    }

    private checkFieldFn(field: string) {
        const aFn = ['COUNT', 'SUM', 'DATE', 'LENGTH', 'MIN', 'MAX'];
        const aFn2 = ['LEFT', 'RIGHT'];

        for (const item of aFn) {
            const chkKey = this.pregMatch(field, new RegExp(`^${item}\\(\\s*([^\\s\\)]+)\\s*\\)$`, 'i'), 1) as string;
            if (chkKey) {
                return chkKey;
            }
        }

        for (const item of aFn2) {
            const chkKey = this.pregMatch(field, new RegExp(`^${item}\\(([^,\\s]+)[\\s,0-9]+\\)$`, 'i'), 1) as string;
            if (chkKey) {
                return chkKey;
            }
        }
        return null;
    }

    private async checkField(table: string, field: string[], isFn = true) {
        if (!(await this.checkTable(table))) {
            return false;
        }
        const aField = _.map(await this.getFields(table), _item => _item.Field);
        let aCheck = _.difference(field, aField);

        if (_.size(aCheck) > 0 && isFn) {
            for (let val of aCheck) {
                const chkFn = this.checkFieldFn(val);
                if (chkFn) {
                    val = chkFn;
                }
            }
            aCheck = _.difference(aCheck, aField);
        }

        if (_.size(aCheck) === 0) {
            return true;
        }

        this.addErrorLogs(`checkField : ${table} (${_.join(aCheck, ',')})`);
        return false;
    }

    public async selectQuery(_active: IActive) {
        const active = { ..._active } as IActivePrivate;
        if (!(await this.initQuery(active))) {
            return null;
        }

        const query = [
            'SELECT', '{field}', 'FROM', '{table}', '{useIndex}', '{join}', '{where}', '{groupBy}', '{having}', '{orderBy}', '{limit}'
        ];
        const info: IActiveInfo = {};

        // field
        info.field = this.getFieldQuery(active);
        if (info.field === null || !info.field) {
            return null;
        }

        // from
        info.table = `\`${active.table}\``;
        if (_.get(active, 'as')) {
            info.table += ` AS \`${active.as}\``;
        }

        // index
        if (_.get(active, 'useIndex')) {
            info.useIndex = ` USE INDEX (${active.useIndex}) `;
        }

        // join
        const sJoin = this.getJoinQuery(active);
        if (sJoin === null) {
            return null;
        }
        if (sJoin && _.size(sJoin) > 0) {
            info.join = sJoin;
        }

        // where
        const sWhere = this.getWhereQuery(active);
        if (sWhere === null) {
            return null;
        }
        if (sWhere && _.size(sWhere) > 0) {
            info.where = ` WHERE ${sWhere}`;
        }

        // groupBy
        const sGroupBy = this.getGroupByQuery(active);
        if (sGroupBy === null) {
            return null;
        }
        if (sGroupBy && _.size(sGroupBy) > 0) {
            info.groupBy = `GROUP BY ${sGroupBy}`;
        }

        // having
        if ((_.get(active, 'having') && this.getKeys(active.having).length > 0) ||
            (_.get(active, 'havingOr') && this.getKeys(active.havingOr).length > 0)) {
            const hActive = { ...active };
            hActive.where = active.having;
            hActive.whereOr = active.havingOr;

            const sHaving = this.getWhereQuery(hActive);
            if (sHaving === null) {
                return null;
            }
            if (sHaving && _.size(sHaving) > 0) {
                info.having = `HAVING ${sHaving}`;
            }
        }

        // orderBy
        const sOrderBy = this.getOrderByQuery(active);
        if (sOrderBy === null) {
            return null;
        }
        if (sOrderBy && _.size(sOrderBy) > 0) {
            info.orderBy = `ORDER BY ${sOrderBy}`;
        }

        // limit
        const sLimit = this.getLimitQuery(active);
        if (sLimit === null) {
            return null;
        }
        if (sLimit && _.size(sLimit) > 0) {
            info.limit = `LIMIT ${sLimit}`;
        }

        return this.makeQuery(query, info);
    }

    public async countQuery(_active: IActive) {
        const active = { ..._active } as IActivePrivate;
        if (!(await this.initQuery(active))) {
            return null;
        }

        // having 예외처리
        if ((_.get(active, 'having') && this.getKeys(active.having).length > 0) ||
            (_.get(active, 'havingOr') && this.getKeys(active.havingOr).length > 0)) {
            _.unset(active, 'offset');
            _.unset(active, 'limit');
            let sQuery = await this.selectQuery(active);
            if (sQuery === null || !sQuery) {
                return null;
            }
            return `SELECT COUNT(1) AS cnt FROM ( ${sQuery} ) AS qcnt`;
        }

        const query = [
            'SELECT', '{count}', 'FROM', '{table}', '{useIndex}', '{join}', '{where}'
        ];
        const info: IActiveInfo = {};

        // count
        info.count = this.getCountQuery(active);
        if (info.count === null || !info.count) {
            return null;
        }

        // table
        info.table = `\`${active.table}\` `;
        if (_.get(active, 'as')) {
            info.table += ` AS \`${active.as}\``;
        }

        // index
        if (_.get(active, 'useIndex')) {
            info.useIndex = ` USE INDEX (${active.useIndex})`;
        }

        // where
        const sWhere = this.getWhereQuery(active);
        if (sWhere === null) {
            return null;
        }
        if (sWhere && _.size(sWhere) > 0) {
            info.where = ` WHERE ${sWhere}`;
        }

        // join (필요없는 조인 제거)
        const joinActive = this.clearJoinActive(active, info);
        const sJoin = this.getJoinQuery(joinActive, true);
        if (sJoin === null) {
            return null;
        }
        if (sJoin && _.size(sJoin) > 0) {
            info.join = sJoin;
        }

        return this.makeQuery(query, info);
    }

    public async insertQuery(_active: IActive) {
        const active = { ..._active } as IActivePrivate;
        if (!(await this.initQuery(active))) {
            return null;
        }

        const query = [
            'INSERT INTO', '{table}', 'SET', '{data}'
        ];
        const info: IActiveInfo = {};

        // table
        info.table = `\`${active.table}\``;

        // data
        info.data = this.getDataQuery(active);
        if (info.data === null || !info.data) {
            return null;
        }

        return this.makeQuery(query, info);
    }

    public async insertAllQuery(_active: IActive) {
        const active = { ..._active } as IActivePrivate;
        if (!(await this.initQuery(active))) {
            return null;
        }

        if (_.get(active, 'field')) {
            if (!(await this.checkField(active.table, active.field, false))) {
                this.addErrorLogs('no field');
                return null;
            }
        } else {
            active.field = _.map(await this.getFields(active.table), _item => _item.Field);
        }

        const query = [
            'INSERT INTO', '{table}', '{field}', 'VALUES', '{values}'
        ];
        const info: IActiveInfo = {};

        // table
        info.table = `\`${active.table}\``;

        // field
        info.field = `(\`${_.join(active.field, '`,`')}\`)`;

        // values
        info.values = this.getDataListQuery(active);
        if (info.values === null || !info.values) {
            return null;
        }

        return this.makeQuery(query, info);
    }

    public async updateQuery(_active: IActive) {
        const active = { ..._active } as IActivePrivate;
        if (!(await this.initQuery(active))) {
            return null;
        }

        const query = [
            'UPDATE', '{table}', '{useIndex}', '{set}', '{where}'
        ];
        const info: IActiveInfo = {};

        // table
        info.table = `\`${active.table}\``;

        // index
        if (active.useIndex) {
            info.useIndex = ` USE INDEX (${active.useIndex})`;
        }

        // set
        const sSet = this.getSetQuery(active);
        if (sSet === null || !sSet) {
            return null;
        }
        info.set = `SET ${sSet}`;

        // where
        const sWhere = this.getWhereQuery(active);
        if (sWhere === null || !sWhere || _.size(sWhere) === 0) {
            this.addErrorLogs('no where');
            return null;
        }
        info.where = `WHERE ${sWhere}`;

        return this.makeQuery(query, info);
    }

    public async insertUpdateQuery(_active: IActive) {
        const active = { ..._active } as IActivePrivate;
        if (!(await this.initQuery(active))) {
            return null;
        }

        const query = [
            'INSERT INTO', '{table}', 'SET', '{data}', 'ON DUPLICATE KEY UPDATE', '{set}'
        ];
        const info: IActiveInfo = {};

        // table
        info.table = `\`${active.table}\``;

        // data
        info.data = this.getDataQuery(active);
        if (info.data === null || !info.data) {
            return null;
        }

        // set
        info.set = this.getSetQuery(active);
        if (info.set === null || !info.set) {
            return null;
        }

        return this.makeQuery(query, info);
    }

    public async deleteQuery(_active: IActive) {
        const active = { ..._active } as IActivePrivate;
        if (!(await this.initQuery(active))) {
            return null;
        }

        const query = [
            'DELETE FROM', '{table}', '{where}', '{orderBy}', '{limit}'
        ];
        const info: IActiveInfo = {};

        // table
        info.table = `\`${active.table}\``;

        // where
        const sWhere = this.getWhereQuery(active);
        if (sWhere === null || !sWhere || _.size(sWhere) <= 0) {
            this.addErrorLogs('no where');
            return null;
        }
        info.where = `WHERE ${sWhere}`;

        // order by
        const sOrderBy = this.getOrderByQuery(active);
        if (sOrderBy === null) {
            return null;
        }
        if (sOrderBy && _.size(sOrderBy) > 0) {
            info.orderBy = `ORDER BY ${sOrderBy}`;
        }

        // limit
        const sLimit = this.getLimitQuery(active, false);
        if (sLimit === null) {
            return null;
        }
        if (sLimit && _.size(sLimit) > 0) {
            info.limit = `LIMIT ${sLimit}`;
        }

        return this.makeQuery(query, info);
    }

    private getJoins(active: IActiveJoins, parentPath = '') {
        let joins: IActiveJoin[] = [];
        const joinType = {
            innerJoin: 'INNER',
            leftJoin: 'LEFT',
            rightJoin: 'RIGHT',
            outerJoin: 'OUTER',
            joins: 'joins'
        };
        for (const key of _.keys(joinType)) {
            if (_.get(active, key) && _.size(active[key]) > 0) {
                for (const item of active[key] as IActiveJoin[]) {
                    const join = {
                        ...item
                    };
                    if (key !== 'joins') {
                        join.type = joinType[key];
                    } else if (!join.type) {
                        join.type = 'LEFT';
                    }
                    join.type = join.type.toUpperCase() as any;
                    join.path = `${join.table}:${join.as || ''}`;
                    if (parentPath) {
                        join.path = `${parentPath}.${join.path}`;
                    }

                    _.unset(join, 'joins');
                    _.unset(join, 'leftJoin');
                    _.unset(join, 'innerJoin');
                    _.unset(join, 'rightJoin');
                    _.unset(join, 'outerJoin');

                    joins.push(join);
                    if (item.joins || item.leftJoin || item.innerJoin || item.rightJoin || item.outerJoin) {
                        const joins2 = this.getJoins(item, join.path);
                        if (_.size(joins2) > 0) {
                            joins = [
                                ...joins,
                                ...joins2
                            ];
                        }
                    }
                }
            }
        }
        return joins;
    }

    private getJoinQuery(active: IActivePrivate, clear = false) {
        if (!active.joins || active.joins.length === 0) {
            return '';
        }
        let sJoin = '';
        for (const join of active.joins) {
            if (clear && join.clear) {
                continue;
            }
            sJoin += ` ${join.type === 'OUTER' ? 'FULL':''} ${join.type} JOIN `;

            if (join.query) {
                sJoin += ` ( ${join.query} ) `;
                // 쿼리 조인은 as 필수
                if (!join.as) {
                    this.addErrorLogs('join query need as');
                    return null;
                }
            } else if (join.table) {
                sJoin += ` \`${join.table}\` `;
            } else {
                this.addErrorLogs('join no table');
                return null;
            }

            if (join.as) {
                sJoin += ` AS ${join.as}`;
            }

            if (!join.on) {
                this.addErrorLogs('join no on');
                return null;
            }

            // 필드명만 있는경우는 PK로 비교
            if (_.isSymbol(join.on) || (_.isString(join.on) && !this.pregMatch(join.on, /[=><]+/))) {
                if (_.isSymbol(join.on)) {
                    join.on = join.on.description;
                }
                const sPK = this.getPKField(active, join.table);
                if (!sPK) {
                    this.addErrorLogs(`join on PK : ${join.table}`);
                    return null;
                }
                join.on = {
                    [sPK]: Symbol(join.on)
                };
            }

            let sJoinOn = '';
            if (_.isString(join.on)) {
                sJoinOn = join.on;

                if (active.table && active.as) {
                    sJoinOn = _.replace(sJoinOn, `\`${active.table}\`.`, `\`${active.as}\`.`);
                }

                if (!join.query) {
                    if (join.table && join.as) {
                        sJoinOn = _.replace(sJoinOn, `\`${join.table}\`.`, `\`${join.as}\`.`);
                    }
                }
            } else if (_.size(join.on) > 0) {
                const joinActive = {
                    ...active,
                    table: join.table,
                    as: join.as
                };
                sJoinOn = this.getWhereBuild(joinActive, join.on, 'AND', false);
                if (sJoinOn === null || !sJoinOn) {
                    return null;
                }
            } else {
                this.addErrorLogs('join on : not support');
                return null;
            }

            sJoin += ` ON ${sJoinOn} `;
        }
        return sJoin;
    }

    private getWhereQuery(active: IActivePrivate) {
        let sWhere = '';
        let whereAnd = '';
        let whereOr = '';

        if (_.get(active, 'where') && this.getKeys(active.where).length > 0) {
            whereAnd = this.getWhereBuild(active, active.where, 'AND', false);
            if (whereAnd === null || !whereAnd) {
                return null;
            }
        }

        if (_.get(active, 'whereOr') && this.getKeys(active.whereOr).length > 0) {
            whereOr = this.getWhereBuild(active, active.whereOr, 'OR', false);
            if (whereOr === null || !whereOr) {
                return null;
            }
        }

        if (whereAnd) {
            sWhere += ` AND ${whereAnd} `;
        }
        if (whereOr) {
            sWhere += ` OR ${whereOr} `;
        }
        if (_.get(active, 'sWhere')) {
            sWhere += ` ${active.sWhere} `;
        }

        if (sWhere) {
            if (_.startsWith(_.trim(sWhere), 'OR')) {
                sWhere = ` 0 ${sWhere}`;
            } else if (_.startsWith(_.trim(sWhere), 'AND')) {
                sWhere = ` 1 ${sWhere}`;
            }
        }

        return sWhere;
    }

    private getWhereBuild(active: IActivePrivate, list: any, where = 'AND', bracket = false) {
        let sReturn = '';
        const keys = this.getKeys(list);
        for (const _key of keys) {
            const _val = list[_key];
            if (sReturn.length > 0) {
                sReturn += ` ${where} `;
            }

            let keyVal = '';
            if (typeof _key === 'symbol') {
                const des = _key.description.toLocaleUpperCase();
                if (!_.includes(['OR', 'AND'], des)) {
                    this.addErrorLogs(`where symbol : ${des}`);
                    return null;
                }
                keyVal = this.getWhereBuild(active, _val, des, true);
            } else {
                keyVal = this.getWhereKeyVal(active, _key, _val);
            }

            if (!keyVal) {
                return null;
            }

            sReturn += ` ${keyVal} `;
        }

        if (bracket) {
            sReturn = ` ( ${sReturn} ) `;
        }

        return sReturn;
    }

    private getWhereKeyVal(active: IActivePrivate, key: string, val: any) {
        let sReturn = '';

        const aTFInfo = this.getTableField(active, key);
        if (aTFInfo === null) {
            return null;
        }
        let selectVal = false;
        let valTFInfo = null;

        // 해당 조건문만 허용
        const aIfs = ['=', '!=', '>', '>=', '<', '<=', '%', '!%'];
        if (!_.includes(aIfs, aTFInfo.if)) {
            this.addErrorLogs(`if error : ${aTFInfo.field} ${aTFInfo.if} ${val}`);
            return null;
        }

        // 값이 필드명인지 체크
        if (_.isSymbol(val)) {
            valTFInfo = this.getTableField(active, val.description);
            if (valTFInfo === null) {
                this.addErrorLogs(`val table field : ${val.description}`);
                return null;
            }

            // 필드명인 경우 해당 조건문만 허용
            if (!_.includes(['=', '!=', '>', '>=', '<', '<='], valTFInfo.if)) {
                this.addErrorLogs(`val table field if error : ${valTFInfo.field} ${valTFInfo.if}`);
                return null;
            }

            // 비교할 필드가 같은지 체크
            if (aTFInfo.field === valTFInfo.field) {
                this.addErrorLogs(`val table field same : ${aTFInfo.field} = ${valTFInfo.field}`);
                return null;
            }
        } else {
            // 값이 배열일 경우 예외처리
            if (_.isArray(val) && !_.includes(['=', '!='], aTFInfo.if)) {
                this.addErrorLogs(`if error : ${aTFInfo.field} ${aTFInfo.if} (${_.join(val, ', ')})`);
                return null;
            }

            // 값이 서브쿼리인지 체크
            if (_.includes(['=', '!='], aTFInfo.if) && !_.isArray(val)) {
                if (this.pregMatch(val, /\(SELECT[^\)]+\)/i)) {
                    selectVal = true;
                }
            }

            // 데이터 체크
            if (aTFInfo.type) {
                if (_.isArray(val)) {
                    for (let _val of val) {
                        const chkVal = this.checkDataType(aTFInfo.type, _val);
                        if (chkVal === false) {
                            this.addErrorLogs(`data err : ${aTFInfo.field} = ${_val}`);
                            return null;
                        }
                        _val = chkVal;
                    }
                } else {
                    const chkVal = this.checkDataType(aTFInfo.type, val);
                    if (chkVal === false) {
                        this.addErrorLogs(`data err : ${aTFInfo.field} = ${val}`);
                        return null;
                    }
                    val = chkVal;
                }
            }
        }

        sReturn = `${aTFInfo.field} `;
        if (valTFInfo) {
            sReturn += `${aTFInfo.if} ${valTFInfo.field}`;
        } else {
            switch (aTFInfo.if) {
                case '=':
                case '!=':
                {
                    const ifArr = { '=': 'IN', '!=': 'NOT IN' };
                    const ifArr2 = { '=': 'IS', '!=': 'IS NOT' };
                    if (val === null) {
                        sReturn += `${ifArr2[aTFInfo.if]} NULL`;
                    } else if (selectVal) {
                        sReturn += `${ifArr[aTFInfo.if]} ${val} `;
                    } else if (_.isArray(val)) {
                        if (aTFInfo.continue) {
                            sReturn += `${ifArr[aTFInfo.if]} (${_.join(val, ', ')}) `;
                        } else {
                            sReturn += `${ifArr[aTFInfo.if]} ("${_.join(val, '", "')}") `;
                        }
                    } else {
                        sReturn += aTFInfo.if;
                        if (!aTFInfo.continue) {
                            val = `"${val}"`;
                        }
                        sReturn += ` ${val} `;
                    }
                    break;
                }
                case '%':
                case '!%':
                {
                    const ifArr = { '%': 'LIKE', '!%': 'NOT LIKE' };
                    sReturn += ifArr[aTFInfo.if];
                    if (!aTFInfo.continue) {
                        val = `"${val}"`;
                    }
                    sReturn += ` ${val} `;
                    break;
                }
                case '>':
                case '>=':
                case '<':
                case '<=':
                {
                    sReturn += aTFInfo.if;
                    if (!aTFInfo.continue) {
                        val = `"${val}"`;
                    }
                    sReturn += ` ${val} `;
                    break;
                }
            }
        }

        return sReturn;
    }

    private checkDataType(type: string, val: any) {
        let check = true;
        if (!type) {
            check = false;
        } else if (_.startsWith(type, 'int') || _.startsWith(type, 'tinyint') || _.startsWith(type, 'float') || _.startsWith(type, 'bigint')) {
            const number = _.toNumber(val);
            if (_.isNaN(number)) {
                check = false;
            } else if (type.indexOf('unsigned') !== -1 && number < 0) {
                check = false;
            }
        } else if (_.startsWith(type, 'text') || _.startsWith(type, 'varchar') || _.startsWith(type, 'mediumtext') || _.startsWith(type, 'longtext') || _.startsWith(type, 'char')) {
            // is null 예외처리
            if (val !== null) {
                if (_.startsWith(type, 'varchar') || _.startsWith(type, 'char')) {
                    let strLen = _.toNumber(this.pregMatch(type, /[a-z]+\(([0-9]+)\)/, 1));
                    if (_.isNaN(strLen) || strLen <= 0) {
                        strLen = 255;
                    }
                    // 숫자 방지
                    val = `${val}`;
                    val = val.substring(0, strLen);
                }
                val = this.escape(val);
            }
        } else if (_.startsWith(type, 'enum')) {
            const sEnum = type.substring(6, type.length - 2);
            const aEnum = _.split(sEnum, '\',\'');
            if (!_.includes(aEnum, val)) {
                return false;
            }
        } else if (_.startsWith(type, 'datetime') || _.startsWith(type, 'date')) {
            // LEFT, RIGHT 함수 사용할경우 예외처리, LIKE 사용하는 경우 예외처리
            const val2 = this.pregMatch(val, /[0-9\-\:\s\%]+/);
            if (val !== val2) {
                check = false;
            }
        } else if (type === 'json') {
            if (val !== null) {
                val = this.escape(JSON.stringify(val));
            }
        }

        if (val === null) {
            check = true;
        }

        if (check === false) {
            return false;
        }

        return val;
    }

    private getGroupByQuery(active: IActivePrivate) {
        let sGroupBy = '';
        if (_.get(active, 'groupBy') && _.size(active.groupBy) > 0) {
            for (const key of _.keys(active.groupBy)) {
                const val = active.groupBy[key];
                const aTFInfo = this.getTableField(active, val);
                if (aTFInfo === null) {
                    return null;
                }
                sGroupBy += `, ${aTFInfo.field} `;
            }
        }
        if (sGroupBy.length > 0) {
            sGroupBy = sGroupBy.substring(1);
        }
        return sGroupBy;
    }

    private getOrderByQuery(active: IActivePrivate) {
        let sOrderBy = '';
        if (_.get(active, 'orderBy') && _.size(active.orderBy) > 0) {
            const isArray = _.isArray(active.orderBy);
            for (const key of _.keys(active.orderBy)) {
                const val = active.orderBy[key];
                let _key = '';
                let _val = '';

                if (isArray) {
                    if (!_.isArray(val) || val.length !== 2) {
                        this.addErrorLogs(`orderBy : ${key} : ${val}`);
                        return null;
                    }
                    _key = val[0];
                    _val = val[1].toUpperCase();
                } else {
                    _key = key;
                    _val = val.toUpperCase();
                }


                if (!_.includes(['ASC', 'DESC'], _val)) {
                    this.addErrorLogs(`orderBy : ${_key} : ${_val}`);
                    return null;
                }

                const aTFInfo = this.getTableField(active, _key);
                if (aTFInfo === null) {
                    return null;
                }
                sOrderBy += `, ${aTFInfo.field} ${_val} `;
            }
            if (sOrderBy.length > 0) {
                sOrderBy = sOrderBy.substring(1);
            }
        }
        return sOrderBy;
    }

    private getLimitQuery(active: IActivePrivate, offset = true) {
        let sLimit = '';
        let offsetNum = _.toNumber(_.get(active, 'offset'));
        const limitNum = _.toNumber(_.get(active, 'limit'));

        if (_.get(active, 'offset') && (_.isNaN(offsetNum) || offsetNum < 0)) {
            this.addErrorLogs(`offset : ${active.offset}`);
            return null;
        }

        if (_.get(active, 'limit') && (_.isNaN(limitNum) || limitNum < 0)) {
            this.addErrorLogs(`limit : ${active.limit}`);
            return null;
        }

        if (offset) {
            if (_.get(active, 'limit') && limitNum > 0) {
                if (!_.get(active, 'offset')) {
                    active.offset = 0;
                    offsetNum = 0;
                }

                sLimit += `${offsetNum}, ${limitNum}`;
            }
        } else if(!_.isNaN(limitNum)) {
            sLimit += limitNum;
        }
        return sLimit;
    }

    private getCountQuery(active: IActivePrivate) {
        let sCount = '';
        if (_.get(active, 'groupBy') && _.size(active.groupBy) > 0) {
            let distinct = '';
            for (const val of active.groupBy) {
                const aTFInfo = this.getTableField(active, val);
                if (aTFInfo === null) {
                    return null;
                }
                distinct += `, ${aTFInfo.field} `;
            }

            sCount = ` COUNT( DISTINCT ${distinct.substring(1)} ) AS count `;
        } else {
            sCount = ' COUNT(1) AS count ';
        }
        return sCount;
    }

    private getDataQuery(active: IActivePrivate) {
        let sData = '';

        if (!_.get(active, 'data') && _.size(active.data) <= 0) {
            this.addErrorLogs('no data');
            return null;
        }

        const data: Record<string, any> = active.data;

        for (const _key of _.keys(data)) {
            let _val = data[_key];
            const aTFInfo = this.getTableField(active, _key);
            if (aTFInfo === null) {
                return null;
            }

            if (aTFInfo.type) {
                const chkVal = this.checkDataType(aTFInfo.type, _val);
                if (chkVal === false) {
                    this.addErrorLogs(`data err : ${aTFInfo.field} = ${_val}`);
                    return null;
                }
                _val = chkVal;
            }

            sData += `, ${aTFInfo.field} = `;
            if (_val === null) {
                sData += 'null ';
            } else {
                if (!aTFInfo.continue) {
                    _val = `"${_val}"`;
                }
                sData += `${_val} `;
            }
        }

        return sData.substring(1);
    }

    private getDataListQuery(active: IActivePrivate) {
        let sDataList = '';

        if (!_.get(active, 'data') || _.size(active.data) <= 0) {
            this.addErrorLogs('no datalist');
            return null;
        }

        if (!_.get(active, 'field') || _.size(active.field) <= 0) {
            this.addErrorLogs('no field');
            return null;
        }

        const datas = active.data as Record<string, any>[];

        for (const data of datas) {
            sDataList += ', (';

            let sData = '';
            for (const field of active.field) {
                const aTFInfo = this.getTableField(active, field);
                if (aTFInfo === null) {
                    return null;
                }

                if (aTFInfo.type && _.get(data, field)) {
                    const chkVal = this.checkDataType(aTFInfo.type, data[field]);
                    if (chkVal === false) {
                        this.addErrorLogs(`data err : ${aTFInfo.field} = ${data[field]}`);
                        return null;
                    }
                    sData += `, "${chkVal}"`;
                } else if(_.has(data, field) && data[field] !== null) {
                    sData += `, "${data[field]}"`;
                } else {
                    sData += `, null`;
                }
            }

            sDataList += `${sData.substring(1)} )`;
        }

        return sDataList.substring(1);
    }

    private getSetQuery(active: IActivePrivate) {
        let sSet = '';
        const aIfs = ['=', '+=', '-='];

        for (const key of _.keys(active.set)) {
            let val = active.set[key];
            const aTFInfo = this.getTableField(active, key);
            if (aTFInfo === null) {
                return null;
            }

            if (!_.includes(aIfs, aTFInfo.if)) {
                this.addErrorLogs(`if error : ${aTFInfo.field} ${aTFInfo.if} ${val}`);
                return null;
            }

            if (aTFInfo.type) {
                const chkVal = this.checkDataType(aTFInfo.type, val);
                if (chkVal === false) {
                    this.addErrorLogs(`data err : ${aTFInfo.field} = ${val}`);
                    return null;
                }
                val = chkVal;
            }

            switch (aTFInfo.if) {
                case '=':
                {
                    sSet += `, ${aTFInfo.field} = `;
                    if (val === null) {
                        sSet += `null `;
                    } else {
                        if (!aTFInfo.continue) {
                            val = `"${val}"`;
                        }
                        sSet += `${val} `;
                    }
                    break;
                }
                case '+=':
                case '-=':
                {
                    const ifArr = {'+=': '+', '-=': '-'};
                    sSet += `, ${aTFInfo.field} = ${aTFInfo.field} ${ifArr[aTFInfo.if]} `;
                    if (aTFInfo.continue) {
                        val = `"${val}"`;
                    }
                    sSet += `${val} `;
                    break;
                }
            }
        }

        if (!sSet || _.size(sSet) === 0) {
            this.addErrorLogs('no set2');
            return null;
        }
        return ` ${sSet.substring(1)} `
    }

    private clearJoinActive(_active: IActivePrivate, info: IActiveInfo) {
        const active = { ..._active };

        if (!active.joins || active.joins.length === 0) {
            return active;
        }

        for (const join of active.joins) {
            // 설정값 우선
            if (join.clear === false || join.clear === true) {
                continue;
            }

            // 쿼리는 변수가 많아서 예외 처리
            if (join.query) {
                join.clear = false;
                continue;
            }

            // where 조건 있는지 체크
            if (info.where) {
                const chkExp = new RegExp(`\\\`*(${join.table}${join.as ? `|${join.as}` : ''})\\\`*\\\.`);
                if (chkExp.test(info.where)) {
                    join.clear = false;
                    continue;
                }
            }

            if (join.type !== 'LEFT') {
                // 최상단 조인은 left 조인만 체크
                if (join.path.indexOf('.') === -1) {
                    join.clear = false;
                    continue;
                } else {
                    for (const join2 of active.joins) {
                        if (join2.path === join.path) {
                            break;
                        }

                        // 부모 테이블이 있을 경우 자식 테이블도 유지
                        if (join.path.indexOf(join2.path) !== -1 && join2.clear === false) {
                            join.clear = false;
                            break;
                        }
                    }
                    if (join.clear === false) {
                        continue;
                    }
                }
            }

            join.clear = true;
        }

        // 부모 테이블이 지워지면 안되는경우 예외처리
        for (const join of active.joins) {
            if (join.clear === false) {
                for (const join2 of active.joins) {
                    if (join2.path === join.path) {
                        continue;
                    }
                    if (!join2.clear) {
                        continue;
                    }
                    if (join.path.indexOf(join2.path) !== -1) {
                        join2.clear = false;
                    }
                }
            }
        }
        return active;
    }

    private makeQuery(query: string[], info: IActiveInfo) {
        if (!query || _.size(query) === 0) {
            return null;
        }
        if (!info || _.size(info) === 0) {
            return null;
        }

        let sQuery = '';
        for (const _query of query) {
            if (_.startsWith(_query, '{') && _.endsWith(_query, '}')) {
                const _field = this.pregMatch(_query, /\{(.+)\}/, 1) as string;
                if (_.get(info, _field)) {
                    sQuery += ` ${info[_field]}`;
                }
            } else {
                sQuery += ` ${_query}`;
            }
        }

        sQuery = _.trim(sQuery);
        if (!sQuery || _.size(sQuery) === 0) {
            return null;
        }

        return sQuery;
    }

    private escape(text: string | string[]) {
        if (_.isArray(text)) {
            return (<string[]>text).map((t) => this.escape(t));
        }

        if (text && _.isString(text)) {
            return (<string>text).replace(/[\0\x08\x09\x1a\n\r"'\\]/g, (char) => {
                switch (char) {
                    case '\0':
                        return '\\0';
                    case '\x08':
                        return '\\b';
                    case '\x09':
                        return '\\t';
                    case '\x1a':
                        return '\\z';
                    case '\n':
                        return '\\n';
                    case '\r':
                        return '\\r';
                    case '\"':
                    case '\'':
                    case '\\':
                        return '\\' + char;
                }
            });
        }

        return text;
    }

    private pregMatch(string: string, regexp: RegExp, index = 0) {
        const match = regexp.exec(string);
        if (!match) {
            return null;
        }
        if (index === -1) {
            return match;
        }
        return _.get(match, index);
    }

    private getKeys(array) {
        if (!array) {
            return [];
        }

        try {
            return [
                ...Object.keys(array),
                ...Object.getOwnPropertySymbols(array)
            ];
        } catch (e) {
            return []
        }
    }
}

export default DBQB;
