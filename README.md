# iobroker-face-detection
iobroker Script für Face Detection/Recognition mit tensorflow für INTEL ATOM CPUs

1. Erstelle die Datenbank. Dort werdne GEsichtsmerkmale gespeichert
```
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
```

2. Speichere das Script- z.B.auch global um es überall zu verwenden
3.  Models runterladen unter
    https://github.com/justadudewhohacks/face-api.js-models/tree/master
    Speicherpfad in  0_userdata.0.face_detection.model_path
    

4. Bekannte Gesichter anlegen
```
 // Add faces
face.addNewFacesFromFolder('<path_to_folder_with_images', 'Nachname', 'Vorname')
.then((result) => {
    console.log('Neue Gesichter wurden erfolgreich hinzugefügt.');
    
})
.catch((error) => {
    log(error,'error');
});
```
5. Gesichter erkennen
```
// Detect Faces
const result = await face.detectFaces('<path_to_image.jpg>');
console.log(result);
```
