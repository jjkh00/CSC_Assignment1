import React, { Component } from 'react';
import axios from 'axios';
import $ from 'jquery';



class Home extends Component {
	constructor( props ) {
		super( props );
		this.state = {
		 selectedFile: null,
		 selectedFiles: null
		}
	   }

	   singleFileChangedHandler = ( event ) => {
		  // console.log(event.target.files);
		this.setState({
		 selectedFile: event.target.files[0]
		});
	   };

	   singleFileUploadHandler = ( event ) => {
		const data = new FormData();// If file selected
		if ( this.state.selectedFile ) {
			data.append( 'profileImage', this.state.selectedFile, this.state.selectedFile.name );
			axios.post( '/api/profile/profile-img-upload', data, {
		  	headers: {
		   		'accept': 'application/json',
		   		'Accept-Language': 'en-US,en;q=0.8',
		   		'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
		  }
		 })
		  .then( ( response ) => {if ( 200 === response.status ) {
			// If file size is larger than expected.
			if( response.data.error ) {
			 if ( 'LIMIT_FILE_SIZE' === response.data.error.code ) {
			  this.ocShowAlert( '	Max size: 2MB', 'red' );
			 } else {
			  console.log( response.data );// If not the given file type
			  this.ocShowAlert( response.data.error, 'red' );
			 }
			} else {
			 // Success
			 let fileName = response.data;
			 console.log( 'fileName', fileName );
			 this.ocShowAlert( 'File Uploaded', '#3089cf' );
			}
		   }
		  }).catch( ( error ) => {
		  // If another error
		  this.ocShowAlert( error, 'red' );
		  //retry posting if network error(while loop)
		  var counter=0;
		  while(counter<2){
			axios.post( '/api/profile/profile-img-upload', data, {
				headers: {
					 'accept': 'application/json',
					 'Accept-Language': 'en-US,en;q=0.8',
					 'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
			}
		   });
		  counter++;
		  console.log(counter);
		  }
	 	 });
		} else {
		 // if file not selected throw error
		 this.ocShowAlert( 'Please upload file', 'red' );
		}};

		// ShowAlert Function
 	ocShowAlert = ( message, background = '#3089cf' ) => {
	let alertContainer = document.querySelector( '#oc-alert-container' ),
	 alertEl = document.createElement( 'div' ),
	 textNode = document.createTextNode( message );
	alertEl.setAttribute( 'class', 'oc-alert-pop-up' );
	$( alertEl ).css( 'background', background );
	alertEl.appendChild( textNode );
	alertContainer.appendChild( alertEl );
	setTimeout( function () {
	 $( alertEl ).fadeOut( 'slow' );
	 $( alertEl ).remove();
	}, 3000 );
   };

	render() {
		//console.log(this.state);
		return(
			<div className="container">
				 {/* For Alert box*/}
				 <div id="oc-alert-container"></div>
				{/* Single File Upload*/}
				<div className="card border-light mb-3 mt-5" style={{ boxShadow: '0 5px 10px 2px rgba(195,192,192,.5)' }}>
      			<div className="card-header">
       			<h3 style={{ color: '#555', marginLeft: '12px' }}>Single Image Upload</h3>
       			<p className="text-muted" style={{ marginLeft: '12px' }}>Upload Size: 250px x 250px ( Max 2MB )</p>
      			</div>
      			<div className="card-body">
       			<p className="card-text">Please upload an image to send to AWS S3</p>
       			<input type="file" onChange={this.singleFileChangedHandler}/>
      			<div className="mt-5">
        			<button className="btn btn-info" onClick={this.singleFileUploadHandler}>Upload!</button>
       			</div>
      			</div>
     			</div>
			</div>
		);
	}
}

export default Home;