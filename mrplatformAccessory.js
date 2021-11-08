'use strict'
const baseUrlV0 = "https://api.meraki.com/api/v0"
const baseUrlV1 = "https://api.meraki.com/api/v1"

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class MRPlatformAccessory {
//private service: Service;

  constructor(platform,accessory){
  	this.platform = platform
  	this.accessory = accessory
  	  	
    for (let i = 0; i < this.accessory.context.device.wlanCount; i++) {
	    const iString = i.toString()
	    
	    const switchService = this.accessory.getService(iString) ?? this.accessory.addService(this.platform.Service.Switch, this.accessory.context.device.ssidList[i].ssid, iString)
      // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
      // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
      // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Switch, 'NAME', 'USER_DEFINED_SUBTYPE');

      // register handlers for the On/Off Characteristic
      switchService.getCharacteristic(this.platform.Characteristic.On)
        .on('set', this.setPowerState.bind(this, i))   // SET - bind to the `setPowerState` method below
//        .on('get', this.getPowerState.bind(this, i))		// GET - bind to the `getPowerState` method below
    }
 
    // set accessory information
    
    this.accessory.getService(this.platform.Service.AccessoryInformation)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Meraki')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.device.serial)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.accessory.context.device.firmware)
		this.timer = setTimeout(this.poll.bind(this), this.platform.refreshInterval)
		this.poll()
	}
/*
	async getPowerState(index, callback) {
		try {
			const response = await this.platform.session({
				method: 'get',
				url: baseUrlV0 + "/networks/" + this.accessory.context.device.networkId + "/ssids/" + this.accessory.context.device.ssidList[index].wlanNumber,
				data: {},
				headers: {
					"X-Cisco-Meraki-API-Key": this.platform.apiKey,
					"Accept": "application/json",
					"Content-Type": "application/json"
				},
				timeout: this.platform.timeout
			}).catch(err => {
					this.platform.log.error('Error getting WLAN state %s',err)
			})
			var powerState = response.data.enabled
			this.accessory.context.device.ssidList[index].state = powerState
			this.platform.log('Get WLAN state for %s = %s',  this.accessory.context.device.ssidList[index].ssid, powerState)
			callback (null, powerState)
		}catch(err) {
			this.platform.log.error('Error getting WLAN state %s', err)
			callback (err, null)
		}
	}
*/
	async setPowerState(index, powerState, callback) {
		try {
//			this.platform.log('Setting WLAN state for %s = %s', this.accessory.context.device.ssidList[index].ssid, powerState)
			const response = await this.platform.session({
				method: 'put',
				url: baseUrlV0 + "/networks/" + this.accessory.context.device.networkId + "/ssids/" +  this.accessory.context.device.ssidList[index].wlanNumber,
				data: { 'enabled': powerState},
				headers: {
					"X-Cisco-Meraki-API-Key": this.platform.apiKey,
					"Accept": "application/json",
					"Content-Type": "application/json"
				},
				timeout: this.platform.timeout
			}).catch(err => {
					this.platform.log.error('Error setting WLAN state %s',err)
					this.platform.log.warn(err.response.data.errors)
			})
			this.accessory.context.device.ssidList[index].state = powerState
			this.platform.log("Set " + this.accessory.context.device.ssidList[index].ssid + " to " + powerState)
			this.updateUI(index)
			callback (null)
		}catch(err) {
			this.platform.log.error('Error setting WLAN state %s', err)
			callback (err)
		}
	}

	//
	//	This will update the homekit UI

	async updateUI(index) {
		setTimeout( () => {
			this.accessory.services[index+1].getCharacteristic(Characteristic.On).updateValue(this.accessory.context.device.ssidList[index].state)
			if (this.platform.debug) this.platform.log(this.accessory.context.device.ssidList[index].ssid + " = " + this.accessory.context.device.ssidList[index].state)
		}, 100)
	}
	
	async poll() {
		if(this.timer) clearTimeout(this.timer)
		this.timer = null
		try {
			const response = await this.platform.session({
				method: 'get',
				url: baseUrlV0 + "/networks/" + this.accessory.context.device.networkId + "/ssids",
				data: {},
				headers: {
					"X-Cisco-Meraki-API-Key": this.platform.apiKey,
					"Accept": "application/json",
					"Content-Type": "application/json"
				},
				timeout: this.platform.timeout
			}).catch(err => {
					this.platform.log.error('Error getting WLAN state %s',err)
			})
//			this.platform.log('During poll, SSIDs response %s', response.data)
			for (let i = 0; i < this.accessory.context.device.wlanCount; i++) {
				let obj = response.data.find(o => o.number === this.accessory.context.device.ssidList[i].wlanNumber)
//				this.platform.log('Obj for SSID %s', this.accessory.context.device.ssidList[i].ssid, obj)
				this.accessory.context.device.ssidList[i].state = obj.enabled				
				this.updateUI(i)
			}
		}catch(err) {
				this.platform.log.error('Error getting WLAN state %s',err)
		}
		this.timer = setTimeout(this.poll.bind(this), this.platform.refreshInterval)
	}

}

module.exports=MRPlatformAccessory;