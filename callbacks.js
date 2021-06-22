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



callbacks.onInstalled = (message) => {
    console.log('On init', message)
}

callbacks.onMessage = (message, sender, callback) => {
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
}