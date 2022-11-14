import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
    declaration: true,
    entries: [
        'src/index',
        'src/sequelize'
    ],
    rollup: {
        emitCJS: true
    }
});
