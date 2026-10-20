// Prepare the public game-information site. Server/admin/history files stay independent.
import {fileURLToPath} from 'node:url';
import {prepareGameInformation} from './prepare-game-information.mjs';
await prepareGameInformation(fileURLToPath(new URL('../', import.meta.url)));