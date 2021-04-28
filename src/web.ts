import express, { Express } from 'express';
import exphbs from 'express-handlebars';
import * as http from 'http';
import { execSync } from 'child_process';
import path from 'path';

import { PORT_REPLACEMENT, ServerInfo, SettingsInfo } from './settings';
import { getLogger, LoggerType } from './logger';
import { ServerState, ServerStatus } from './types';


export class Web {
    settings: SettingsInfo;
    app: Express;
    server?: http.Server;
    logger: LoggerType;

    constructor(settings: SettingsInfo) {
        this.settings = settings;
        this.logger = getLogger();
        this.app = express();
    }

    init() {
        this.app.engine('hbs', exphbs({
            defaultLayout: 'main',
            layoutsDir: path.join(__dirname, './views/layouts/'),
            extname: '.hbs',
            helpers: {
                title: () => { return this.settings.pageTitle },
                favIcon: () => { return this.settings.favIcon },
                json: (content: string) => { return JSON.stringify(content) }
            }
        }));

        this.app.set('view engine', 'hbs');
        this.app.use(express.static(path.join(__dirname, './views')));
        this.app.use(express.json());       // to support JSON-encoded bodies
        this.app.use(express.urlencoded({     // to support URL-encoded bodies
            extended: true
        }));

        this.app.get('/', (req, res) => {
            res.render(path.join(__dirname, './views/home'), { servers: this.settings.servers });
        });

        this.app.post('/wakeup', (req, res) => {
            this.logger.info('WakeUp Received : ' + JSON.stringify(req.body));
            const serv = this.settings.servers.find(serv => serv.displayName === req.body.displayName)
            if (serv) {
                this.wakeUp(serv);
            }
            res.send('received');
        })

        this.app.get('/status', async (req, res) => {
            const status = this.settings.servers.map(serv => this.getState(serv))
            res.json(status);
        });

        this.server = this.app.listen(this.settings.webPort, () => {
            this.logger.info(`Starting web server on *:${this.settings.webPort}`);
        })
    }

    wakeUp(server: ServerInfo) {
        this.logger.info('WakingUp ' + server.displayName);
        try {
            const result = execSync(server.startCmd, { cwd: server.workingDirectory }).toString();
            this.logger.info('WakeUp Result ' + result);
        }
        catch (error) {
            this.logger.info('WakeUp Error ' + error.message);
        }
    }

    close() {
        this.server?.close;
    }

    getState = (serv: ServerInfo): ServerState => {
        let state: ServerState = { displayName: serv.displayName, serverStatus: ServerStatus.Sleeping, detail: '' };
        const cmd = this.settings.statusCmd.replace(PORT_REPLACEMENT, serv.port.toString());
        try {
            state.detail = execSync(cmd).toString();
            state.serverStatus = ServerStatus.Online;
        }
        catch (err) {
            // this.logger.info(`Error on command [${cmd}] : ${err.message}`)
        }
        return state;
    }


}

