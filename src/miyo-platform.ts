import WebSocket from "ws";
import {
  API,
  APIEvent,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from "homebridge";

const PLUGIN_NAME = "homebridge-miyo-garden";
const PLATFORM_NAME = "MiyoPlatform";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, MiyoPlatform);
};

class MiyoPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private readonly port: Number;
  private readonly ipAddress: String;
  private readonly apiKey: String;

  private ws?: WebSocket;

  private readonly accessories: PlatformAccessory[] = [];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;
    this.port = config["port"];
    this.ipAddress = config["ip"];
    this.apiKey = config["apiKey"];

    // probably parse config or something here

    log.info("MIYO platform finished initializing!");

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.info("MIYO platform 'didFinishLaunching'");

      // The idea of this plugin is that we open a http service which exposes api calls to add or remove accessories
      this.connectToMiyoCube();
    });
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log("Configuring accessory %s", accessory.displayName);

    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log("%s identified!", accessory.displayName);
    });

    /* accessory
      .getService(hap.Service.Lightbulb)!
      .getCharacteristic(hap.Characteristic.On)
      .on(
        CharacteristicEventTypes.SET,
        (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
          this.log.info("%s Light was set to: " + value);
          callback();
        }
      ); */

    this.accessories.push(accessory);
  }

  // --------------------------- CUSTOM METHODS ---------------------------

  addAccessory(name: string) {
    this.log.info("Adding new accessory with name %s", name);

    // uuid must be generated from a unique but not changing data source, name should not be used in the most cases. But works in this specific example.
    const uuid = hap.uuid.generate(name);
    const accessory = new Accessory(name, uuid);

    accessory.addService(hap.Service.LightSensor, "Lichtintensität");

    this.configureAccessory(accessory); // abusing the configureAccessory here

    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);
  }

  removeAccessories() {
    // we don't have any special identifiers, we just remove all our accessories

    this.log.info("Removing all accessories");

    this.api.unregisterPlatformAccessories(
      PLUGIN_NAME,
      PLATFORM_NAME,
      this.accessories
    );
    this.accessories.splice(0, this.accessories.length); // clear out the array
  }

  connectToMiyoCube() {
    this.ws = new WebSocket(`ws://${this.ipAddress}:${this.port}/`, {
      perMessageDeflate: false,
    });

    this.ws.on("open", () => {
      this.ws?.send(
        JSON.stringify({
          id: 10,
          apiKey: this.apiKey,
          method: "Device.all",
        })
      );
    });

    var interval = setInterval(() => {
      this.ws?.send(
        JSON.stringify({
          id: 10,
          apiKey: this.apiKey,
          method: "Device.all",
        })
      );
    }, 1000 * 60 *10);

    this.ws.on("message", (message: Buffer) => {
      //console.log('received: %s', message.toString('utf8'));
      const update = JSON.parse(message.toString());
      switch (update.id) {
        case -1:
          switch (update.notification) {
            case "Device.stateChanged":
              console.log("received Update: %s", update.params);
              service.updateCharacteristic(Characteristic.Brightness, 60);
              break;

            default:
              console.log("received notification: %s", update);
              break;
          }
          break;
        case 10:
          const devices = update.params.devices;
          Object.keys(devices).forEach(function (device) {
            var value = devices[device];
          });
          console.log("received devices: %s", devices);
          break;
        default:
          console.log("received message: %s", update);
          break;
      }
    });
  }

  // ----------------------------------------------------------------------
}
