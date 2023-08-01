const path = require('path');
const chalk = require('chalk');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/cli-lib/logger');
const { handleKeypress } = require('@hubspot/cli-lib/lib/process');
const {
  getAccountId,
  getConfigDefaultAccount,
} = require('@hubspot/cli-lib/lib/config');
const SpinniesManager = require('./SpinniesManager');
const DevServerManager = require('./DevServerManager');
const { EXIT_CODES } = require('./enums/exitCodes');
const { getProjectDetailUrl } = require('./projects');
const {
  COMPONENT_TYPES,
  findProjectComponents,
  getAppCardConfigs,
} = require('./projectStructure');
const {
  UI_COLORS,
  uiCommandReference,
  uiAccountDescription,
  uiBetaMessage,
  uiLink,
  uiLine,
} = require('./ui');

const i18nKey = 'cli.lib.LocalDevManager';

class LocalDevManager {
  constructor(options) {
    this.targetAccountId = options.targetAccountId;
    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.debug = options.debug || false;
    this.alpha = options.alpha;
    this.deployedBuild = options.deployedBuild;

    this.projectSourceDir = path.join(
      this.projectDir,
      this.projectConfig.srcDir
    );

    if (!this.targetAccountId || !this.projectConfig || !this.projectDir) {
      logger.log(i18n(`${i18nKey}.failedToInitialize`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async start() {
    SpinniesManager.stopAll();
    SpinniesManager.init();

    if (!this.deployedBuild) {
      logger.log();
      logger.error(
        i18n(`${i18nKey}.noDeployedBuild`, {
          accountIdentifier: uiAccountDescription(this.targetAccountId),
        })
      );
      process.exit(EXIT_CODES.SUCCESS);
    }

    const components = await findProjectComponents(this.projectSourceDir);

    if (!components.length) {
      logger.log();
      logger.error(i18n(`${i18nKey}.noComponents`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    const runnableComponents = components.filter(
      component => component.runnable
    );

    if (!runnableComponents.length) {
      logger.log();
      logger.error(i18n(`${i18nKey}.noRunnableComponents`));
      process.exit(EXIT_CODES.SUCCESS);
    }

    logger.log();
    const setupSucceeded = await this.devServerSetup(runnableComponents);

    if (setupSucceeded || !this.debug) {
      console.clear();
    }

    uiBetaMessage(i18n(`${i18nKey}.betaMessage`));
    logger.log();
    logger.log(
      chalk.hex(UI_COLORS.SORBET)(
        i18n(`${i18nKey}.running`, {
          accountIdentifier: uiAccountDescription(this.targetAccountId),
          projectName: this.projectConfig.name,
        })
      )
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.viewInHubSpotLink`),
        getProjectDetailUrl(this.projectConfig.name, this.targetAccountId)
      )
    );
    logger.log();
    logger.log(i18n(`${i18nKey}.quitHelper`));
    uiLine();
    logger.log();

    await this.devServerStart();

    this.updateKeypressListeners();

    this.compareLocalProjectToDeployed(runnableComponents);
  }

  async stop() {
    SpinniesManager.add('cleanupMessage', {
      text: i18n(`${i18nKey}.exitingStart`),
    });

    const cleanupSucceeded = await this.devServerCleanup();

    if (!cleanupSucceeded) {
      SpinniesManager.fail('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingFail`),
      });
      process.exit(EXIT_CODES.ERROR);
    }

    SpinniesManager.succeed('cleanupMessage', {
      text: i18n(`${i18nKey}.exitingSucceed`),
    });
    process.exit(EXIT_CODES.SUCCESS);
  }

  updateKeypressListeners() {
    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        this.stop();
      }
    });
  }

  logUploadWarning(reason) {
    const currentDefaultAccount = getConfigDefaultAccount();
    const defaultAccountId = getAccountId(currentDefaultAccount);

    logger.log();
    logger.warn(i18n(`${i18nKey}.uploadWarning.header`, { reason }));
    logger.log(
      i18n(`${i18nKey}.uploadWarning.stopDev`, {
        command: uiCommandReference('hs project dev'),
      })
    );
    if (this.targetAccountId !== defaultAccountId) {
      logger.log(
        i18n(`${i18nKey}.uploadWarning.runUploadWithAccount`, {
          command: uiCommandReference(
            `hs project upload --account=${this.targetAccountId}`
          ),
        })
      );
    } else {
      logger.log(
        i18n(`${i18nKey}.uploadWarning.runUpload`, {
          command: uiCommandReference('hs project upload'),
        })
      );
    }
    logger.log(
      i18n(`${i18nKey}.uploadWarning.restartDev`, {
        command: uiCommandReference('hs project dev'),
      })
    );
  }

  compareLocalProjectToDeployed(runnableComponents) {
    const deployedComponentNames = this.deployedBuild.subbuildStatuses.map(
      subbuildStatus => subbuildStatus.buildName
    );

    let missingComponents = [];

    runnableComponents.forEach(({ type, config, path }) => {
      if (type === COMPONENT_TYPES.app) {
        const cardConfigs = getAppCardConfigs(config, path);

        if (!deployedComponentNames.includes(config.name)) {
          missingComponents.push(
            `${i18n(`${i18nKey}.uploadWarning.appLabel`)} ${config.name}`
          );
        }

        cardConfigs.forEach(cardConfig => {
          if (
            cardConfig.data &&
            cardConfig.data.title &&
            !deployedComponentNames.includes(cardConfig.data.title)
          ) {
            missingComponents.push(
              `${i18n(`${i18nKey}.uploadWarning.appLabel`)} ${
                cardConfig.data.title
              }`
            );
          }
        });
      }
    });

    if (missingComponents.length) {
      this.logUploadWarning(
        i18n(`${i18nKey}.uploadWarning.missingComponents`, {
          missingComponents: missingComponents.join(', '),
        })
      );
    }
  }

  async devServerSetup(components) {
    try {
      await DevServerManager.setup({
        alpha: this.alpha,
        components,
        debug: this.debug,
        onUploadRequired: this.logUploadWarning.bind(this),
      });
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.setupError`, { message: e.message })
      );
      return false;
    }
  }

  async devServerStart() {
    try {
      await DevServerManager.start({
        alpha: this.alpha,
        accountId: this.targetAccountId,
        projectConfig: this.projectConfig,
      });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.startError`, { message: e.message })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async devServerCleanup() {
    try {
      await DevServerManager.cleanup();
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.cleanupError`, { message: e.message })
      );
      return false;
    }
  }
}

module.exports = LocalDevManager;