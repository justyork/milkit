import '@babel/polyfill';
import { MessageTypes } from './messageTypes';
import { FULL_URL, ONLY_FANS_DOMAIN, ONLY_FANS_ME } from "./chromeUtils/api";
import { fetchModels, login } from './chromeUtils/requests';
import { createUUID } from '../utils/uuid';
import {
    AUTH_MODEL_ID,
    AUTH_TOKEN_KEY,
    NEXT_MODEL_KEY,
    UUID_KEY,
    getFromLocalStorageData,
    removeFromLocalStorageData,
    setToLocalStorageData,
    setAuthKeyToStorage,
    getAuthKeyFromStorage,
    setNextModel,
    getNextModel,
    getCurrentModelFromStorage,
    setCurrentModelToStorage,
    setAuthModelIdKeyToStorage,
    getAvailableModels,
    setModelsToStorage,
} from '../utils/localStorage';
import { getCookiesByDomain, clearAllCookies } from './chromeUtils/cookie';
import { sendMessage } from './chromeUtils/tabs';

const temporaryCookies = {
    ref_src: '',
    st: '',
};

const WS_ENDPOINT = 'wss://ext-ws-server-dev.milkit.workers.dev/ws';

class App {
    run (userId) {
        this.connectToWs(userId)
    }

    connectToWs(userId) {
        const websocket = new WebSocket(`${WS_ENDPOINT}?user_id=${userId}`)

        websocket.addEventListener('message', event => {
            console.log('Message received from server')
            console.log(event.data)
        })

        websocket.onopen = function(e) {
            console.log('[open] Connection established')
            console.log('Sending to server')
            websocket.send(JSON.stringify({ message: 'My name is John' }))
        }

    }

}
(new App).run(USER_ID);


chrome.runtime.onInstalled.addEventListener((message) => {
    console.log('Installed', message)
})


// The sendResponse callback is only valid if used synchronously,
// or if the event handler returns true to indicate that it will respond asynchronously.
// eslint-disable-next-line no-undef
chrome.runtime.onMessage.addListener((message, sender, callback) => {
    if (message.messageType === MessageTypes.AUTHORIZE) {
        const { username, password } = message.data;

        login({
            username,
            password,
            deviceId: getUUID(),
        }).then((response) => {
            if (!response?.error) {
                setAuthKeyToStorage(response);
            }
            callback(response);
        });

        return true;
    }

    if (message.messageType === MessageTypes.GET_AUTH_DATA) {
        const token = getAuthKeyFromStorage();
        callback(token);
    }

    if (message.messageType === MessageTypes.FETCH_ADULT_MODELS) {
        const { uuid } = message.data;

        fetchModels(uuid).then((response) => {
            callback(response);
        });

        return true;
    }

    if (message.messageType === MessageTypes.CHANGE_ADULT_MODEL) {
        const { externalId } = message.data;
        const models = getAvailableModels();

        const [currentModel] = models.filter((i) => i.model_id === externalId);

        // Clear cookies
        clearAllCookies().then(() => {
            if (currentModel) {
                setNextModel(currentModel);
            }
            callback(currentModel);
        });

        return true;
    }

    if (message.messageType === MessageTypes.GET_NEXT_MODEL) {
        const nextModel = getNextModel();
        callback(nextModel);
    }

    if (message.messageType === MessageTypes.CLEAR_NEXT_MODEL) {
        removeFromLocalStorageData(NEXT_MODEL_KEY);
        callback(true);
    }

    if (message.messageType === MessageTypes.LOGOUT) {
        removeFromLocalStorageData(AUTH_TOKEN_KEY);
        removeFromLocalStorageData(AUTH_MODEL_ID);
        callback(true);
    }

    if (message.messageType === MessageTypes.GET_CURRENT_USER_DATA) {
        const currentModelData = getCurrentModelFromStorage();
        callback(currentModelData);
    }

    if (message.messageType === MessageTypes.GET_ADULT_MODEL) {
        const models = getAvailableModels();
        callback(models);
    }

    if (message.messageType === MessageTypes.CLEAR_COOKIE) {
        clearAllCookies().then(() => {
            callback(true);
        });

        return true;
    }

    if (message.messageType === MessageTypes.GET_DOMAIN_COOKIES) {
        getCookiesByDomain(ONLY_FANS_DOMAIN, (cookies) => {
            callback(cookies);
        });

        return true;
    }
});

// eslint-disable-next-line no-undef
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const { requestHeaders } = details;

        setTimeout(() => {
            getCookiesByDomain(
                ONLY_FANS_DOMAIN,
                (cookies) => {
                    if (requestHeaders) {
                        const { xbc, userAgent } = getDataFromRequestHeaders(requestHeaders);
                        const { fp, sess, auth_id, csrf, st, ref_src } =
                            getDataFromCookieObj(cookies);
                        const cookie = createCookieString({
                            fp,
                            csrf,
                            auth_id,
                            ref_src,
                            st,
                            sess,
                        });

                        const modelData = {
                            model_id: auth_id,
                            chatter_id: generateHash(),
                            cookie: cookie,
                            xbc: xbc,
                            useragent: userAgent,
                        };

                        try {
                            // Set current model data to local storage
                            setCurrentModelToStorage(modelData);
                            setAuthModelIdKeyToStorage(auth_id);

                            const availableModels = getAvailableModels();

                            const isHasModel = availableModels.some(
                                (model) => model.model_id === auth_id
                            );

                            const resultModels =
                                availableModels.length === 0
                                    ? [modelData]
                                    : availableModels.map((model) => {
                                        if (model.model_id === auth_id) return modelData;
                                        return model;
                                    });

                            if (!isHasModel) {
                                resultModels.push(modelData);
                            }

                            setModelsToStorage(resultModels);

                            sendMessage({ messageType: MessageTypes.UPDATE_PLUGIN }, () => {});
                        } catch (e) {
                            console.error('Error save adultModel data', modelData);
                            console.error(e);
                        }
                    }
                },
                4000
            );
        });
    },
    { urls: [ONLY_FANS_ME] },
    ['requestHeaders', 'blocking']
);

function getUUID() {
    const UUIDLocal = getFromLocalStorageData(UUID_KEY);
    if (UUIDLocal) return UUIDLocal;

    const UUID = createUUID();
    setToLocalStorageData(UUID_KEY, UUID);

    return UUID;
}

function createCookieString({ fp, sess, auth_id, csrf, st, ref_src }) {
    return `fp=${fp}; sess=${sess}; auth_id=${auth_id} csrf=${csrf} st=${st} ref_src=${ref_src}`;
}

function getDataFromCookieObj(cookies) {
    const [fp] = cookies.filter((i) => i.name === 'fp');
    const [sess] = cookies.filter((i) => i.name === 'sess');
    const [auth_id] = cookies.filter((i) => i.name === 'auth_id');
    const [csrf] = cookies.filter((i) => i.name === 'csrf');
    const [st] = cookies.filter((i) => i.name === 'st');
    const [ref_src] = cookies.filter((i) => i.name === 'ref_src');

    if (ref_src && st) {
        temporaryCookies.st = st.value;
        temporaryCookies.ref_src = ref_src.value;
    }

    return {
        fp: fp?.value,
        sess: sess.value,
        auth_id: auth_id.value,
        csrf: csrf.value,
        st: st?.value || temporaryCookies.st,
        ref_src: ref_src?.value || temporaryCookies.ref_src,
    };
}

function getDataFromRequestHeaders(requestHeaders) {
    const [xbc] = requestHeaders.filter((i) => i.name === 'x-bc');
    const [userAgent] = requestHeaders.filter((i) => i.name === 'User-Agent');

    return {
        xbc: xbc.value,
        userAgent: userAgent.value,
    };
}

function generateHash() {
    return `_${Math.random().toString(36).substr(2, 9)}`;
}
