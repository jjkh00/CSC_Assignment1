const express = require( 'express' );
const aws = require( 'aws-sdk' );
const multerS3 = require( 'multer-s3' );
const multer = require('multer');
const path = require( 'path' );
const { resolve } = require('path');
const { CodeBuild } = require('aws-sdk');

const router = express.Router();


const BitlyClient = require('bitly').BitlyClient;
const bitly = new BitlyClient('64948d9a94ed29df9ce4abe09ca4435b777f3171');


/**
 * PROFILE IMAGE STORING STARTS
 */
const s3 = new aws.S3({
    accessKeyId: 'AKIAQHTZOSPSRJJSV235',
    secretAccessKey: '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',
    Bucket: 'task5cscbucket'
   });

   /**
 * Single Upload
 */
const profileImgUpload = multer({
    storage: multerS3({
     s3: s3,
     bucket: 'task5cscbucket',
     acl: 'public-read',
     key: function (req, file, cb) {
      cb(null, path.basename( file.originalname, path.extname( file.originalname ) ) + '-' + Date.now() + path.extname( file.originalname ) );
    }
    }),
    limits:{ fileSize: 2000000 }, // In bytes: 2000000 bytes = 2 MB
    fileFilter: function( req, file, cb ){
     checkFileType( file, cb );
    }
   }).single('profileImage');

//    /**
//  * Check File Type
//  * @param file
//  * @param cb
//  * @return {*}
//  */


function checkFileType( file, cb ){
    // Allowed ext
    const filetypes = /jpeg|jpg|png|gif/;
    // Check ext
    const extname = filetypes.test( path.extname( file.originalname ).toLowerCase());
    // Check mime
    const mimetype = filetypes.test( file.mimetype );if( mimetype && extname ){
     return cb( null, true );
    } else {
     cb( 'Error: Images Only!' );
    }
   }

   //Bitly shorten url function
    async function init(url){
    let result;
    try {
      result = await bitly.shorten(url);
      console.log('Bitly init: ' + result.link);
      return result.link;
    } catch (e) {
      throw e;
    }
  }

//    /**
//  * @route POST api/profile/business-img-upload
//  * @desc Upload post image
//  * @access public
//  */
router.post( '/profile-img-upload', ( req, res ) => {
    profileImgUpload( req, res, ( error ) => {
    // console.log( 'requestOkokok', req.file );
    // console.log( 'error', error );
    if( error ){
     console.log( 'errors', error );
     res.json( { error: error } );
    } else if(req.file === undefined) {
     // If File not found
      console.log( 'Error: No File Selected!' );
      res.json( 'Error: No File Selected' );
    } else {
      // If Success
      const imageName = req.file.key;
      let imageLocation = req.file.location;// Save the file name into database into profile model
      (async () => {
        console.log('Initializing async to get data from init function');
        let shorturl = await init(imageLocation); 
        res.json({
          image: imageName,
          location: shorturl
       });
      })()
      
     }
   });
  });


  module.exports = router;
