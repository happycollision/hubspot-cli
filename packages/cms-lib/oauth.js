const OAuth2Manager = require('@hubspot/api-auth-lib/OAuth2Manager');
const { updatePortalConfig, getPortalConfig } = require('./lib/config');
const { logger, logErrorInstance } = require('./logger');
const { AUTH_METHODS } = require('./lib/constants');

const oauthManagers = new Map();

const writeOauthTokenInfo = (portalConfig, tokenInfo) => {
  const { portalId, authType, auth, env } = portalConfig;

  logger.debug(`Updating Oauth2 token info for portalId: ${portalId}`);

  updatePortalConfig({
    environment: env,
    portalId,
    authType,
    ...auth,
    tokenInfo,
  });
};

const getOauthManager = (portalId, portalConfig) => {
  if (!oauthManagers.has(portalId)) {
    const writeTokenInfo = tokenInfo => {
      writeOauthTokenInfo(portalConfig, tokenInfo);
    };
    oauthManagers.set(
      portalId,
      OAuth2Manager.fromConfig(portalId, portalConfig, logger, writeTokenInfo)
    );
  }
  return oauthManagers.get(portalId);
};

const setupOauth = (portalId, portalConfig) => {
  const config = getPortalConfig(portalId) || {};
  return new OAuth2Manager(
    {
      ...portalConfig,
      environment: config.env || 'prod',
    },
    logger
  );
};

const addOauthToPortalConfig = (portalId, oauth) => {
  logger.log('Updating configuration');
  try {
    updatePortalConfig({
      ...oauth.toObj(),
      authType: AUTH_METHODS.oauth.value,
      portalId,
    });
    logger.log('Configuration updated');
    process.exit();
  } catch (err) {
    logErrorInstance(err);
  }
};

module.exports = {
  getOauthManager,
  setupOauth,
  addOauthToPortalConfig,
};
