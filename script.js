/**
 * @description Face detection für ARM CPUs. SQL Datenbank benötigt
 * 
 * 
 * 
 * @link https://github.com/vladmandic/face-api 
 * tensorflow models
 * @link https://github.com/justadudewhohacks/face-api.js-models/tree/master
 * 
 *
 * //npm Module
 * @see https://www.npmjs.com/package/@vladmandic/face-api 
 * @see https://www.npmjs.com/package/@tensorflow/tfjs
 * @see https://www.npmjs.com/package/@tensorflow/tfjs-backend-wasm
 * @see https://www.npmjs.com/package/canvas
 * @see https://www.npmjs.com/package/path
*/


/*
// sql anweisungen
  `face_id` int(11) NOT NULL AUTO_INCREMENT,
  `date` datetime NOT NULL DEFAULT current_timestamp(),
  `marks` text NOT NULL,
  `img_name` varchar(100) DEFAULT NULL,
  `img_path` varchar(500) DEFAULT NULL,
  `person_id` int(11) NOT NULL,
  PRIMARY KEY (`face_id`),
  KEY `face_facemarks_person_id_IDX` (`person_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COMMENT='Speicherung von bilderdaten'

CREATE TABLE `face_persons` (
  `person_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `face_descriptors` text DEFAULT NULL,
  PRIMARY KEY (`person_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4

CREATE TABLE `face_detection` (
  `image_id` int(11) NOT NULL AUTO_INCREMENT,
  `date` datetime NOT NULL DEFAULT current_timestamp(),
  `age` float DEFAULT NULL,
  `gender` varchar(500) DEFAULT NULL,
  `gender_percent` float DEFAULT NULL,
  `expression` varchar(500) DEFAULT NULL,
  `expression_percent` float DEFAULT NULL,
  `person_id` int(11) DEFAULT NULL,
  `image` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`image_id`),
  KEY `face_detection_person_id_IDX` (`person_id`,`image_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
*/

// load all modules
const face_detect = {
    // @ts-ignore
    tf: require('@tensorflow/tfjs'), 
    wasm: require('@tensorflow/tfjs-backend-wasm'), 
    path: require('path'),
    fs: require('fs'),
}
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');// @ts-ignore
//face_detect.wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/');
face_detect.wasm.setWasmPaths('/opt/iobroker/iobroker-data/face_api/tfjs-backend-wasm/package/dist/');
const canvas = require('canvas');
// @ts-ignore
await face_detect.tf.setBackend('wasm');
// @ts-ignore
await face_detect.tf.ready();

// um lokale Bilder überhaupt laden zu können
const { Canvas, Image, ImageData } = canvas;
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

class face_broker{
    constructor () {
        this.persons = []; // alle gespeicherten Personen
        this.constants = {
            DATABASE: 'iobroker',
            IOBROKER_DATAPOINTS: '0_userdata.0.face_detection', // Datenpunkt Ablage in iobroker
            MODEL_PATH: '/opt/iobroker/iobroker-data/files/0_userdata.0/face_api/models/',
            FACE_PATH: 'face_api/faces/',
            NO_IMAGES_AVAILABLE: 'Keine Bilder verfügbar',
            ERROR_CREATING_NEW_PERSON: 'Fehler beim erzeugen einer neuen Person. Siehe Fehlermeldung.',
            SINGLE_FACE_DETECTION_WENT_WRONG: 'Fehler bei Einzel-Gesichtserkennung.',
            NEW_FACE_MARKING_IN_DB: 'Neuer Datenbankeintrag für Bild',
            DATABASE_ERROR: 'Datenbank Fehler',
            NEW_PERSON_CREATED: 'Neuer Personeneintrag in Datenbank',
            FACE_DESCRIPTOR_UPDATE: 'Face-Descriptror erfolgreich gespeichert',
            ERROR_MOVING_FILE: 'Beim verschieben der Datei ist etwas schief gelaufen',
            NO_FACE_DESCRIPTORS: 'Keine verfügbaren Gesichts-Merkmale gefunde für Person',
            NO_LABELED_FACE_DESCRIPTORS: 'Es konnte kein Labeled Face Descriptor ersteelt werden ',
            FAILED_FACE_DESCRIPTOR_JSON: 'Es konnte kein JSON zum abspeichern des Face Descriptors erstellt werden für ',
            NO_LABELED_FACE_DESCRIPTORS_FOUND: 'Es konnte kein Labeled Face Descriptor in der Datenbank gefunden werden.',
            GET_SOME_LABELED_FACE_DESCRIPTORS: 'Anzahl der gefundenen Labeled Face Descriptors',
            NEW_FACE_DETECTION: 'Neue Gesichtserkennung erfolgeich abgeschlossen.',
            NEW_FACE_DETECTION_SAVE: 'Aktuelle Gesichtserkennung in Datenbank gespeichert',
            NO_FACES_DETECTED: 'Keine Gesichter auf dem aktuellen Bild gefunden',
            UNKNOWN: 'Unbekannte Person',
            EXPRESSIONS: {
                angry: ['Wütend','😠'],
                disgusted: ['Angewidert','🤢'],
                fearful: ['Ängstlich','😱'],
                happy: ['Glücklich','😃'],
                neutral: ['Neutral','😐'],
                sad: ['Traurig','😐'],
                surprised: ['Überrascht','😮'],
            },
            GENDER: {
                female: 'Weiblich',
                male: 'Männlich'
            },
        }; // Konstanten

    }

    async initDataPoints() {
        // Überprüfe und erstelle Datenpunkte
        await this.checkAndCreateState(`${this.constants.IOBROKER_DATAPOINTS}.database`, this.constants.DATABASE);
        await this.checkAndCreateState(`${this.constants.IOBROKER_DATAPOINTS}.model_path`, this.constants.MODEL_PATH);
        await this.checkAndCreateState(`${this.constants.IOBROKER_DATAPOINTS}.face_path`, this.constants.FACE_PATH);

        // Lese die aktuellen Werte der Datenpunkte
        this.database = (await getStateAsync(`${this.constants.IOBROKER_DATAPOINTS}.database`)).val;
        this.model_path = (await getStateAsync(`${this.constants.IOBROKER_DATAPOINTS}.model_path`)).val;
        this.face_path = (await getStateAsync(`${this.constants.IOBROKER_DATAPOINTS}.face_path`)).val;
    }

    async checkAndCreateState(id, defaultValue) {
        const exists = await existsStateAsync(id);
        if (!exists) {
            await createStateAsync(id, {
                type: 'string',
                read: true,
                write: true,
                def: defaultValue
            });
            await setStateAsync(id, defaultValue);
        }
    }

    /**
     * @description Lädt benötigte tensorflow Modelle 
     */
    async loadTensorModels(){
        // tensorflow Models laden
        await Promise.all([
            // @ts-ignore
            faceapi.nets.ssdMobilenetv1.loadFromDisk(this.model_path),
            // @ts-ignore
            faceapi.nets.faceLandmark68Net.loadFromDisk(this.model_path),
            // @ts-ignore
            faceapi.nets.ageGenderNet.loadFromDisk(this.model_path),
            // @ts-ignore
            faceapi.nets.faceExpressionNet.loadFromDisk(this.model_path),
            // @ts-ignore
            faceapi.nets.faceRecognitionNet.loadFromDisk(this.model_path),
        ])
        // faceLandmark68TinyNet
        // tinyFaceDetector
        // tinyYolov2
    }

    /**
     * @description Erstellt aus lokalen Bild-Dateien das richtige Format für face-api
     * @param {string} img_path
     * @return {Promise} 
     */
    async getImage(img_path){
        // Bild laden
        // @ts-ignore
        return canvas.loadImage(img_path);
    }

    /**
     * @description Erzeugt eine neue Person in mysql Datenbank und liefertt neue Person_ID zurück
     * @param {string} name
     * @param {string} first_name
     * @return {Promise} - bei resolve {number} Neue Person_ID des erzeugten Datensatzes, bei reject {boolean} Fehlermeldung
     */
    async newPerson(name,first_name){
        const query = `INSERT INTO  ${this.database}.face_persons (name, first_name) VALUES ('${name}','${first_name}')`;
        const messages = this.constants;
        return new Promise(function (resolve, reject) {
            sendTo("sql.0", "query", query, function (result){
                if (result.error) {
                    log(`${messages.DATABASE_ERROR} ${result.error}`,'error');
                    resolve(false);
                }
                else{
                    log(`${messages.NEW_PERSON_CREATED} - ${first_name} ${name}`,'info');
                    //{'error':null,'result':{'fieldCount':0,'affectedRows':1,'insertId':3,'serverStatus':2,'warningCount':0,'message':'','protocol41':true,'changedRows':0}}
                    resolve(result.result.insertId);
                }
            });
        });
    }

    /**
     * @description Speichert face_descriptors
     * @param {number} person_id
     * @param {string} face_descriptors
     * @return {Promise} - boolean
     */
    async updateFaceDescriptor(person_id,face_descriptors){
        const query = `UPDATE ${this.database}.face_persons SET face_descriptors = '${face_descriptors}' WHERE person_id = ${person_id}`;
        const messages = this.constants;
        return new Promise(function (resolve, reject) {
            sendTo("sql.0", "query", query, function (result){
                if (result.error) {
                    log(`${messages.DATABASE_ERROR} ${result.error}`,'error');
                    resolve(false);
                }
                else{
                    log(`${messages.FACE_DESCRIPTOR_UPDATE} - ${person_id}`,'info');
                    //{'error':null,'result':{'fieldCount':0,'affectedRows':1,'insertId':3,'serverStatus':2,'warningCount':0,'message':'','protocol41':true,'changedRows':0}}
                    resolve(result.affectedRows);
                }
            });
        });
    }

    /**
     * @description - Datenbank Eintrag der gescannten Bilder
     * @param {string} facemarks - gescannte bilderdaten
     * @param {string} file_path - Dateipfad zu dem Bild
     * @param {string} file_name - Dateiname zu dem Bild
     * @param {number} person_id - Id zu dem Bild
     */
    async storeFaceMarks(facemarks,file_path,file_name,person_id){
        let json_facemarks = JSON.stringify(facemarks);
        const query = `INSERT INTO  ${this.database}.face_facemarks (marks,img_path, img_name, person_id) VALUES ('${json_facemarks}','${file_path}','${file_name}',${person_id})`;
        const messages = this.constants;
        return new Promise(function (resolve, reject) {
            sendTo("sql.0", "query", query, function (result){
                if (result.error) {
                    log(`${messages.DATABASE_ERROR} ${result.error}`,'error');
                    resolve(false);
                }
                else{
                    log(`${messages.NEW_FACE_MARKING_IN_DB} - ${file_name}`,'info');
                    resolve(true);
                }
            });
        });
    }

    /**
     * @description - verschiebt eine Datei
     * @param {string} file_path - Original Dateipfad zu dem Bild
     * @param {string} new_file_path - Neuer Dateipfad
     */
    async moveFile(file_path,new_file_path){
        let data = face_detect.fs.readFileSync(file_path);
        await writeFileAsync('0_userdata.0',new_file_path,data);
        face_detect.fs.unlinkSync(file_path);
        return true;
    }

  
    


    /**
     * @description Scannt Bilder nach einem Gesicht ab und speichert facemarks in mysql Datenbank ab
     * @param {Array<string>} img_paths - Pfade zur Dateien
     * @param {string} name
     * @param {string} first_name
     * @return {Promise} - {boolean} bei Erfolg: resolve -> true, bei Fehler: reject -> false 
     */
    async newFace(img_paths, name, first_name){
        const person_id = await this.newPerson(name, first_name);
        const descriptors = [];
        let i = 0;
        console.log(`person_id = ${person_id}`);
        if(!person_id){
            log(this.constants.ERROR_CREATING_NEW_PERSON,'info');
        }
        if(!Array.isArray(img_paths)){
            img_paths =  [img_paths];
        }
        if(img_paths.length === 0){
            log(this.constants.NO_IMAGES_AVAILABLE,'warn');
            return false;
        }
        for(let image of img_paths){
            const referenceImage = await this.getImage(image);
            const file_name = face_detect.path.posix.basename(image);
            const file_extension = face_detect.path.extname(file_name);
            // create new facemarks
            // @ts-ignore
            const facemarks = await faceapi.detectSingleFace(referenceImage).withFaceLandmarks().withFaceDescriptor();
            if(facemarks){
                // Wenn erfolgreich Bild kopieren in this.face_path mit Namens-Schema und Original löschen
                const new_file_name = `${name}_${first_name}_${person_id}_${i}${file_extension}`;
                const new_file_path = `${this.face_path}/${new_file_name}`;
                
                // Datei verschieben - todo wieder aktivieren
                await this.moveFile(image,new_file_path);
                //this.moveFile(image,new_file_path);
                
                // Neuer Datenbank Face-Mark Eintrag - todo wieder aktivieren
                await this.storeFaceMarks(facemarks,new_file_path,new_file_name,person_id);
                descriptors[i] = facemarks.descriptor;

            }
            else{
                log(this.constants.SINGLE_FACE_DETECTION_WENT_WRONG + `: ${file_name}`,'warn');
            }
            i++;
        }
        if(descriptors.length === 0){
            log(`${this.constants.NO_FACE_DESCRIPTORS} ${name}_${first_name}`,'warn');
            return false;
        }
        //erstelle einen labeledFaceDescriptors
        // @ts-ignore
        const labeledFaceDescriptors = new faceapi.LabeledFaceDescriptors(
            `${name}_${first_name}_${person_id}`,
            descriptors
        );
        if(!labeledFaceDescriptors){
            log(`${this.constants.NO_LABELED_FACE_DESCRIPTORS} ${name}_${first_name}`,'error');
            return false;
        }
        // forme einne json daraus
        const labeledFaceDescriptorsJson = labeledFaceDescriptors.toJSON();
        if(!labeledFaceDescriptorsJson){
            log(`${this.constants.FAILED_FACE_DESCRIPTOR_JSON} ${name}_${first_name}`,'error');
            return false;
        }
        
        // @ts-ignore
        return await this.updateFaceDescriptor(person_id,JSON.stringify(labeledFaceDescriptorsJson));
    }

    /**
     * @description Iteriert über den angegebenen Ordner und legt für jedes Bild ein neues Gesicht an.
     * @param {string} folderPath - Pfad zum Ordner mit Gesichtsbildern.
     * @param {string} name - Name der Person.
     * @param {string} firstName - Vorname der Person.
     * @return {Promise} - Gibt ein Promise zurück, das beim Abschluss aufgelöst wird.
     */
    async addNewFacesFromFolder(folderPath, name, firstName) {
        try {
            // Überprüfe, ob der Ordner existiert
            const exists = face_detect.fs.existsSync(folderPath);
            if (!exists) {
                throw new Error(`Der Ordner ${folderPath} existiert nicht.`);
            }

            // Lese den Inhalt des Ordners
            const files = face_detect.fs.readdirSync(folderPath);

            // Filtere nur Bilddateien heraus
            const imagePaths = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file)).map(file => `${folderPath}/${file}`);

            // Füge jedes Bild als neues Gesicht hinzu
            if (imagePaths.length > 0) {
                return await this.newFace(imagePaths, name, firstName);
            } else {
                throw new Error(`Keine Bild-Dateien im Ordner ${folderPath} gefunden.`);
            }
        } catch (error) {
            console.error(error);
            return false;
        }
        return true;
    }

    /**
     * @description Holt alle Labeled Face Descriptors aus der mysql Datenbank ab
     * @return {Promise<array>} - {Array}
     */
    async getAllLabeledFaceDescriptors(){
        const query = `SELECT face_descriptors FROM ${this.database}.face_persons WHERE face_descriptors IS NOT NULL`;
        const messages = this.constants;
        return new Promise(function (resolve, reject) {
            sendTo("sql.0", "query", query, function (result){
                if (result.error) {
                    log(messages.DATABASE_ERROR +  ` ${result.error}`,'error');
                    resolve([]);
                }
                else{
                    log(`${messages.GET_SOME_LABELED_FACE_DESCRIPTORS} - ${result.result.length}`,'info');
                    resolve(result.result);
                }
            });
        });
    }

    /**
     * @description erzeugt einen FaceMatcher
     * @return {Promise}
     */
    async createFaceMatcher(){
        const sqlJSONlabeledFaceDescriptors = await this.getAllLabeledFaceDescriptors();
        const labeledFaceDescriptors = sqlJSONlabeledFaceDescriptors.map(x => JSON.parse(x.face_descriptors));

        if(labeledFaceDescriptors.length === 0){
            log(this.constants.NO_LABELED_FACE_DESCRIPTORS_FOUND,'error');
            return false;
        }

        // @ts-ignore
        this.faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors.map(jsonlfd => faceapi.LabeledFaceDescriptors.fromJSON(jsonlfd)));
    }

        /**
         * @description Erzeuge das Face-Detecttion Ergebnis
         * @param {Array} detection_results,
         * @param {string} image_path
         * @result {Arrayy<string>}
         */

    async doFaceDetectionResult(detection_results, image_path){
        const dateTime = formatDate(new Date(), "JJJJ-MM-TT SS:mm:ss.sss");
        const messages = this.constants; // class constanten
        let telegram_text = []; // telegram nachricht
        let alexa_text = []; // alexa sprachnachricht

        // wurden gesichter entdeckt ?
        if(detection_results.length){
            const new_img = getState(`${this.constants.IOBROKER_DATAPOINTS}.image_of_faces`).val;
            let i = 0;
            for(let detection_result of detection_results){
                // für jedes Gesicht das erkannt wurde..Details filtern und abspeichern
                let expression = null;
                const details = {
                    age: null,
                    gender: null,
                    gender_percent: null,
                    expression: null,
                    expression_percent: null,
                };

                if(detection_result.hasOwnProperty('age')){
                    details.age = detection_result.age.toFixed(2);
                    detection_results[i].de_age = `${details.age} Jahre alt`;
                }
                if(detection_result.hasOwnProperty('gender')){
                    details.gender = this.constants.GENDER[detection_result.gender];
                }
                if(detection_result.hasOwnProperty('genderProbability')){
                    details.gender_percent = Math.round(detection_result.genderProbability * 100);
                    detection_results[i].de_gender = `${details.gender} (${details.gender_percent}%)`;
                }
                if(detection_result.hasOwnProperty('expressions') && Object.keys(detection_result.expressions).length > 0){
                    expression = Object.keys(detection_result.expressions).reduce((a, b) => detection_result.expressions[a] > detection_result.expressions[b] ? a : b);
                    details.expression = this.constants.EXPRESSIONS[expression][0];
                }
                if(detection_result.hasOwnProperty('expressions') && Object.keys(detection_result.expressions).length > 0 && detection_result.expressions.hasOwnProperty(expression)){
                    details.expression_percent = Math.round(detection_result.expressions[expression] * 100);
                    detection_results[i].de_expression = `${this.constants.EXPRESSIONS[expression][1]} ${details.expression} (${details.expression_percent}%)`;
                }
                if(detection_result.hasOwnProperty('person_id') && detection_result.person_id > 0){
                    details.person_id = detection_result.person_id;
                }

                let columns_array = ["date","image"];
                for(let key in details){
                    if(details[key]){
                        columns_array.push(key);
                    }
                }
                const columns = columns_array.join(",");

                let values_array = [dateTime,image_path];
                for(let key in details){
                    if(details[key]){
                        values_array.push(details[key]);
                    }
                }
                const values = "'" + values_array.join("','") + "'";
                const query = `INSERT INTO  ${this.database}.face_detection (${columns}) VALUES (${values})`;
                const face_json = JSON.stringify(details);
                log(`${messages.NEW_FACE_DETECTION} - ${face_json}`,'info');
                await new Promise(function (resolve, reject) {
                    sendTo("sql.0", "query", query, function (result){
                        if (result.error) {
                            log(`${messages.DATABASE_ERROR} ${result.error}`,'error');
                            resolve(false);
                        }
                        else{
                            
                            log(`${messages.NEW_FACE_DETECTION_SAVE} - ${face_json}`,'info');
                            resolve(true);
                        }
                    });
                });
                //EXPRESSIONS
                const smiley = this.constants.EXPRESSIONS[expression][1];
                
                if(detection_result.name === this.constants.UNKNOWN){
                    telegram_text.push(`Neue ${details.gender} (${details.gender_percent}%) ${detection_result.first_name} ${detection_result.name} entdeckt. Alter ca. ${details.age} , Laune: ${smiley} ${details.expression} (${details.expression_percent}%)`);
                    alexa_text.push(`Neue ${details.expression} aussehende ${details.gender} ${detection_result.first_name} ${detection_result.name} ist an der Tür. Alter ca. ${details.age}.`);
                }
                else{
                    telegram_text.push(`${detection_result.first_name} ${detection_result.name} entdeckt. , Laune: ${smiley} ${details.expression} (${details.expression_percent}%)`);
                    alexa_text.push(`${detection_result.first_name} ${detection_result.name} entdeckt. , Laune: ${smiley} ${details.expression} (${details.expression_percent}%)`);
                }
                i++;
            }
            await this.createResultImage(image_path,detection_results,new_img);
            /*
            if(telegram_text.length > 0){
                sendTo('telegram.0', {
                    text: telegram_text.join('\n\n'),
                    disable_notification: true
                });
            }
            */
            
        }
        else{
            log(this.constants.NO_FACES_DETECTED,'info');
        }
        return telegram_text;
    }

    /**
     * @description erzeugt einen FaceMatcher und sucht nach Gesichtern in einem Bild und versucht diese zu identifizieren
     * @param {string} img_path
     * @return {Promise}
     */
    async detectFaces(img_path){
        const image = await this.getImage(img_path);
        
        // Alle Gesichter erkennen
        // @ts-ignore
        const results = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceDescriptors().withAgeAndGender().withFaceExpressions();

        // Auswertung des Bildes
        let matches = [];
        let bestMatch = [];
        results.forEach(fd => {
            bestMatch = this.faceMatcher.findBestMatch(fd.descriptor);
            matches.push(bestMatch.toString());
        });
        if(results.length && results.length === matches.length){
            for(let i = 0; i < results.length; i++){
                results[i].label = matches[i];
                if(!matches[i].includes('unknown')){
                    const [name, first_name, person_id] = matches[i].split('_');
                    results[i].name = name;
                    results[i].first_name = first_name;
                    results[i].person_id = parseInt(person_id);
                }
                else{
                    results[i].name = this.constants.UNKNOWN;
                    results[i].first_name = '';
                    results[i].person_id = null;
                }
            }
        }
        //console.log(results);
        return await this.doFaceDetectionResult(results, img_path);
    }

    /**
     * @description erzeugt ein Ergbnis-Bild
     * @param {string} img_path - pfad - altes bild
     * @param {Array} results - von faceMatcher
     * @param {string} new_img - pfad neu erschafftes bild
     * @result {Promise<boolean>}
     */
    async createResultImage(img_path,results,new_img){
        const img = await this.getImage(img_path)
        // @ts-ignore
        const out = faceapi.createCanvasFromMedia(img);
        faceapi.draw.drawDetections(out, results.map(res => res.detection))
        results.forEach(result => {
            const { age, gender, genderProbability } = result
            new faceapi.draw.DrawTextField(
            [
                `${result.first_name} ${result.name}`,
                //`${faceapi.utils.round(age, 0)} years`,
                `${result.de_gender}`,
                `${result.de_age}`,
                `${result.de_expression}`,
                //`${gender} (${faceapi.utils.round(genderProbability)})`,
            ],
            result.detection.box.bottomLeft
            ).draw(out)
        })
        /*
            return new faceapi.draw.DrawBox(res.detection.box, { label: bestMatch.toString() })
            const queryDrawBoxes = resultsQuery.map(res => {
            const bestMatch = faceMatcher.findBestMatch(res.descriptor)
            return new faceapi.draw.DrawBox(res.detection.box, { label: bestMatch.toString() })
            })
        */
        let bild = await new Promise(function(resolve,reject){
            face_detect.fs.writeFile(new_img, out.toBuffer('image/jpeg'), async function (err) {
                if (err) {
                    resolve(false);
                }
                else{
                    
                    resolve(true);
                }
            })
        })
        return bild;
    }

}



const face = new face_broker(); 
// @ts-ignore
await face.initDataPoints();
// @ts-ignore
await face.loadTensorModels(); 
// @ts-ignore
await face.createFaceMatcher();


/*
// Detect Faces
const result = await face.detectFaces('<path_to_image.jpg>');
console.log(result);
*/

 /*
 // Add faces
face.addNewFacesFromFolder('<path_to_folder_with_images', 'Nachname', 'Vorname')
.then((result) => {
    console.log('Neue Gesichter wurden erfolgreich hinzugefügt.');
    
})
.catch((error) => {
    log(error,'error');
});

*/
    

