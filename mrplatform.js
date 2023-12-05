'use strict'

//
//	We are going to use axios with SSL for our RESTconf calls to the WLC,
//	so we'll need these node-modules

const https = require('https')
const axios = require('axios')
axios.defaults.withCredentials = true

//
//	Setting up a few constant variables for reference

const packageJson=require('./package')
const MRPlatformAccessory=require('./mrplatformAccessory')

const baseUrlV1 = "https://api.meraki.com/api/v1"
const timeout = 10000
const interval = 15 // Minutes
const debug = false
const	PluginName = packageJson.name
const version = packageJson.version

class MRPlatform {

	//
	//	Setup our instance variables based on the homebridge config.json entries

	constructor(log, config, api) {

		this.log = log
		this.config = config
		this.apiKey = config["apiKey"]
		this.networkId = config["networkId"]
		this.timeout = config["timeout"] === undefined ? timeout : config["timeout"]
		this.refreshInterval = config["refreshInterval"] === undefined ? (interval * 60000) : (config["refreshInterval"] * 60000)
		this.debug = config["debug"] === undefined ? debug : config["debug"]
		this.accessories = []
		this.session = axios.create({
			timeout: this.timeout,
			httpsAgent: new https.Agent({  
				rejectUnauthorized: false
				}),
		})

		if(api){
			this.api=api
			this.Service = this.api.hap.Service
  		this.Characteristic = this.api.hap.Characteristic
			this.api.on("didFinishLaunching", function(){
				//Get devices
				this.getMRDevices()
			}.bind(this))
		}
	}
	
	identify(){
		this.log('Identify the WLC')
	}
	
	configureAccessory(accessory) {
    if (this.config.networks.find( (network) => network.id === accessory.context.device.id ))  {
			if (!this.accessories.find( (anAccessory) => anAccessory.context.device.id === accessory.context.device.id ))  {
				this.log.info('Restoring accessory from cache:', accessory.displayName)

				// create the accessory handler
				// this is imported from `c9000platformAccessory.js`
				new MRPlatformAccessory(this, accessory)

				// add the restored accessory to the accessories cache so we can track if it has already been registered
				this.accessories.push(accessory)
			}
    }
	}
	
	getMRDevices(){

		//
    // Check for a blank config and return without registering accessories

		if(!this.config){
			this.log.warn('Ignoring MR Platform setup because it is not configured')
			return
		}
		
    // loop over the discovered devices and register each one if it has not already been registered
		for (const device of this.config.networks){
			this.log.debug('Getting network list')
			var networkDevice = {
				"displayName": device.displayName,
				"networkId": device.networkId,
				"model": "MR",
				"serial": "dummy-serial",
				"firmware": version,
				"wlanCount": 0,
				"ssidList": [],
			}
			const webConfig = {
				data: {},
				headers: {
					"X-Cisco-Meraki-API-Key": this.apiKey,
					"Accept": "application/json",
					"Content-Type": "application/json"
				}
			}

			this.session.get(baseUrlV1 + "/networks/" + networkDevice.networkId + "/wireless/ssids", webConfig)
				.then(resp => {
					if (this.debug) {
						this.log(baseUrlV1 + "/networks/" + networkDevice.networkId + "/wireless/ssids");
					}
					networkDevice.wlanCount = Object.keys(resp.data).length;
					this.log("Dashboard response: " + networkDevice.wlanCount + " SSID(s).");
			
					var ssids = resp.data;

					for (var i = 0; i < networkDevice.wlanCount; i++) {
						if (ssids[i].name.search("Unconfigured SSID ") != 0)
						{
							if (this.debug) {
								this.log(i, ssids[i].name + " = " + ssids[i].number);
							}
							var wlanNumber = ssids[i].number
							var ssid = ssids[i].name
							var state = ssids[i].enabled
							networkDevice.ssidList.push({wlanNumber,ssid,state})
						}
					}
					networkDevice.wlanCount = networkDevice.ssidList.length
					if (this.debug) this.log(networkDevice.ssidList)
					
					// generate a unique id for the accessory this should be generated from
					// something globally unique, but constant, for example, the device serial
					// number or MAC address
					const uuid = this.api.hap.uuid.generate(device.networkId);

					// check that the device has not already been registered by checking the
					// cached devices we stored in the `configureAccessory` method above
					if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
						this.log.info('Registering new accessory:', device.displayName, uuid)

						// create a new accessory
						const accessory = new this.api.platformAccessory(device.displayName, uuid)

						// store a copy of the device object in the `accessory.context`
						// the `context` property can be used to store any data about the accessory you may need
						accessory.context.device = networkDevice
	
						// create the accessory handler
						// this is imported from `platformAccessory.js`
						new MRPlatformAccessory(this, accessory)

						// link the accessory to your platform
						this.api.registerPlatformAccessories(PluginName, PlatformName, [accessory])

						// push into accessory cache
						this.accessories.push(accessory)
						this.log.info('New accessory:', accessory.displayName)

						// it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
						// this.api.unregisterPlatformAccessories(PluginName, PlatformName, [accessory]);
					}
				})
				.catch(err => {
					this.log.error(err.stack)
				})
		}
	}
}

module.exports=MRPlatform;