const path = require('path');
// eslint-disable-next-line prefer-const
let configFile = undefined;

/**
 * Validate config file.
 * @param {string} configFilePath - The path to the config file.
 * @return {boolean} - Returns true if validation is successful.
 * @throws Will throw an error if the validation fails.
 */
function validate(configFilePath = configFile) {
  const fs = require('fs');
  const path = require('path');
  const validate = require('jsonschema').validate;

  const config = JSON.parse(fs.readFileSync(configFilePath));
  const schema = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'config.schema.json')),
  );
  validate(config, schema, { required: true, throwError: true });
  return true;
}

module.exports = {
  get configFile() {
    return configFile ? configFile : path.join(process.cwd(), 'proxy.config.json');
  },
  set configFile(file) {
    configFile = file;
  },
  validate,
};
