//
//	Standard homebridge platform setup here...

const MRPlatform = require('./mrplatform')
const packageJson = require('./package')

module.exports = (homebridge) => {
	PlatformAccessory = homebridge.PlatformAccessory
	Service = homebridge.hap.Service
	Characteristic = homebridge.hap.Characteristic
	UUIDGen = homebridge.hap.uuid
	PluginName = packageJson.name
	PlatformName = 'Meraki MR'
	
	homebridge.registerPlatform(PluginName, PlatformName, MRPlatform, true)
}
