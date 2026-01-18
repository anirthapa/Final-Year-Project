import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
// import * as mime from 'react-native-mime-types'; // Causing TypeError: property is not configurable in SDK 54

export const API_BASE_URL = 'https://e6dc-202-51-86-227.ngrok-free.app';

// Set up a basic configuration for making API requests
const api = axios.create({
    baseURL: API_BASE_URL, // The main URL of API
    headers: {
        'Content-Type': 'application/json', // Tell the server we're sending JSON data
    },
});
+
    // Before sending a request, add the user's token if they are logged in
    api.interceptors.request.use(async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Don't override Content-Type if it's already set (important for FormData)
        if (!config.headers['Content-Type'] && !(config.data instanceof FormData)) {
            config.headers['Content-Type'] = 'application/json';
        }

        return config;
    }, (error) => {
        return Promise.reject(error);
    });

// After receiving a response, check for errors and handle them
api.interceptors.response.use(
    async (response) => response, // If the response is good, just return it
    (error) => {
        if (error.response) {
            // Handle different types of errors based on the status code
            switch (error.response.status) {
                case 401:
                    // If the user is not authorized, log them out or redirect to login
                    console.error('You are not authorized. Please log in.');
                    break;
                case 404:
                    // If the resource is not found, show a message
                    console.error('The resource you are looking for does not exist.');
                    break;
                case 500:
                    // If there's a server error, let the user know
                    console.error('Something went wrong on the server. Please try again later.');
                    break;
                case 422:
                    // Handle validation errors
                    console.error('Validation failed:', error.response.data);
                    break;
                default:
                    // For any other error, show a generic message
                    console.error('An error occurred:', error.message);
            }
        } else {
            // If there's no response, it might be a network issue
            console.error('There was a network error. Please check your connection.');
        }
        return Promise.reject(error); // Pass the error along
    }
);

/**
 * Function to fetch data from the API
 * @param {string} endpoint - The API endpoint to fetch data from
 * @returns {Promise<any>} The response data
 */
export const fetchData = async (endpoint: string) => {
    try {
        const response = await api.get(endpoint); // Send a GET request to the endpoint
        return response.data; // Return the data from the response
    } catch (error) {
        console.error('Error fetching data:', error); // If something goes wrong, log the error
        throw error; // Re-throw the error so it can be handled elsewhere
    }
};

/**
 * Function to post data with multipart/form-data (for file uploads)
 * @param {string} endpoint - The API endpoint
 * @param {FormData} formData - The form data to send
 * @returns {Promise<any>} The response data
 */
export const postImageData = async (endpoint: string, formData: FormData) => {
    try {

        // Create custom config for formData
        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        };

        // Make the request with formData
        const response = await api.post(endpoint, formData, config);
        return response.data;
    } catch (error) {
        console.error('Error posting form data:', error);
        throw error;
    }
};

/**
 * Function to post JSON data to the API
 * @param {string} endpoint - The API endpoint
 * @param {any} data - The data to send
 * @returns {Promise<any>} The response data
 */
export const postData = async (endpoint: string, data: any) => {
    try {
        // Create config for JSON data
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        // Make the request with JSON data
        const response = await api.post(endpoint, data, config);
        return response.data;
    } catch (error) {
        console.log('Error posting data:', error);
        throw error;
    }
};

/**
 * Function to update data on the API (PUT request)
 * @param {string} endpoint - The API endpoint
 * @param {any} data - The data to update
 * @returns {Promise<any>} The response data
 */
export const updateData = async (endpoint: string, data: any) => {
    try {
        const response = await api.put(endpoint, data); // Send a PUT request to update data
        return response.data; // Return the data from the response
    } catch (error) {
        console.error('Error updating data:', error); // If something goes wrong, log the error
        throw error; // Re-throw the error so it can be handled elsewhere
    }
};

/**
 * Function to update data partially on the API (PATCH request)
 * @param {string} endpoint - The API endpoint
 * @param {any} data - The data to patch
 * @returns {Promise<any>} The response data
 */
export const patchData = async (endpoint: string, data: any) => {
    try {
        const response = await api.patch(endpoint, data); // Send a PATCH request for partial updates
        return response.data; // Return the data from the response
    } catch (error) {
        console.error('Error patching data:', error); // If something goes wrong, log the error
        throw error; // Re-throw the error so it can be handled elsewhere
    }
};

/**
 * Function to delete data from the API
 * @param {string} endpoint - The API endpoint
 * @returns {Promise<any>} The response data
 */
export const deleteData = async (endpoint: string) => {
    try {
        const response = await api.delete(endpoint); // Send a DELETE request
        return response.data; // Return the data from the response
    } catch (error) {
        console.error('Error deleting data:', error); // If something goes wrong, log the error
        throw error; // Re-throw the error so it can be handled elsewhere
    }
};

/**
 * Enhanced function to get file info from URI
 * @param {string} uri - The file URI
 * @returns {Object} File information object
 */
const getFileInfo = async (uri: string) => {
    // Get file name from URI
    const uriParts = uri.split('/');
    const fileName = uriParts[uriParts.length - 1];

    // Try to determine mime type
    let fileType = 'image/jpeg'; // Default

    // Use FileSystem to get file info if available
    if (FileSystem) {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (fileInfo.exists) {
                // Simple extension checking instead of using the problematic library
                if (fileName.includes('.')) {
                    const extension = fileName.split('.').pop()?.toLowerCase();
                    // Basic mime type mapping
                    const mimeTypes: { [key: string]: string } = {
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'gif': 'image/gif',
                        'webp': 'image/webp',
                        'pdf': 'application/pdf',
                        'doc': 'application/msword',
                        'mp4': 'video/mp4'
                    };
                    if (extension && mimeTypes[extension]) {
                        fileType = mimeTypes[extension];
                    }
                }

                // Check if it's an image based on URI or extension
                if (uri.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i)) {
                    // It's an image, fileType should be something like image/jpeg
                } else if (fileName.match(/\.(mov|mp4|avi|mkv|webm)$/i)) {
                    fileType = `video/${fileName.split('.').pop()?.toLowerCase() || 'mp4'}`;
                } else if (fileName.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)) {
                    // fileType = mime.lookup(fileName) || 'application/octet-stream';
                    fileType = 'application/octet-stream';
                }
            }
        } catch (error) {
            console.warn('Could not get file info', error);
            // Fall back to default type based on extension
        }
    }

    return {
        uri,
        name: fileName,
        type: fileType,
        size: 0 // Size information might be added if needed
    };
};

/**
 *  function to upload an image with better error handling and file type detection
 * @param {string} imageUri - The URI of the image to upload
 * @param {Object} options - Additional options for the upload
 * @returns {Promise<string>} The URL of the uploaded image
 */
export const uploadImage = async (imageUri: string, options?: {
    endpoint?: string,
    fieldName?: string,
    additionalFields?: Record<string, any>,
    onProgress?: (progress: number) => void
}) => {
    if (!imageUri) {
        throw new Error('Image URI is required');
    }

    try {
        // Set defaults
        const endpoint = options?.endpoint || '/api/upload/image';
        const fieldName = options?.fieldName || 'image';

        // Create form data for file upload
        const formData = new FormData();

        // Get file information
        const fileInfo = await getFileInfo(imageUri);

        // Append the file to form data
        formData.append(fieldName, fileInfo);

        // Add any additional fields
        if (options?.additionalFields) {
            Object.entries(options.additionalFields).forEach(([key, value]) => {
                formData.append(key, value);
            });
        }

        // Special headers for form data
        const uploadHeaders = {
            'Content-Type': 'multipart/form-data',
        };

        // Upload configuration with progress tracking
        const uploadConfig: any = {
            headers: uploadHeaders,
        };

        // Add progress callback if provided
        if (options?.onProgress && FileSystem.createUploadTask) {
            // Use Expo's FileSystem for upload with progress if available
            const uploadTask = FileSystem.createUploadTask(
                `${API_BASE_URL}${endpoint}`,
                imageUri,
                {
                    fieldName,
                    httpMethod: 'POST',
                    mimeType: fileInfo.type,
                    headers: {
                        ...uploadHeaders,
                        'Authorization': `Bearer ${await AsyncStorage.getItem('token')}`
                    },
                },
                (progress) => {
                    options.onProgress?.(progress.totalByteSent / progress.totalBytesExpectedToSend);
                }
            );

            const result = await uploadTask.uploadAsync();

            if (result.status >= 200 && result.status < 300) {
                // Parse response data
                const responseData = JSON.parse(result.body);
                return responseData.imageUrl || responseData.image || responseData.url;
            } else {
                throw new Error(`Upload failed with status ${result.status}`);
            }
        } else {
            // Use standard axios upload
            const response = await api.post(endpoint, formData, uploadConfig);

            // Return the URL or ID of the uploaded image
            return response.data.imageUrl || response.data.image || response.data.url;
        }
    } catch (error) {
        console.error('Error uploading image:', error);

        // Enhanced error message based on the error type
        if (error.message?.includes('Network Error')) {
            throw new Error('Network error occurred while uploading. Please check your connection.');
        } else if (error.response?.status === 413) {
            throw new Error('Image is too large. Please choose a smaller image.');
        } else if (error.response?.status === 415) {
            throw new Error('Unsupported file type. Please choose a different image format.');
        } else {
            throw error;
        }
    }
};

/**
 * Function to upload multiple images
 * @param {string[]} imageUris - Array of image URIs to upload
 * @param {Object} options - Upload options
 * @returns {Promise<string[]>} Array of uploaded image URLs
 */
export const uploadMultipleImages = async (imageUris: string[], options?: {
    endpoint?: string,
    fieldName?: string,
    onProgress?: (overall: number) => void
}) => {
    if (!imageUris || !imageUris.length) {
        return [];
    }

    const uploadedUrls = [];
    let completedUploads = 0;

    try {
        // Upload images one by one
        for (const uri of imageUris) {
            const imageUrl = await uploadImage(uri, {
                ...options,
                onProgress: options?.onProgress ?
                    (progress) => {
                        // Calculate overall progress across all images
                        const overallProgress = (completedUploads + progress) / imageUris.length;
                        options.onProgress?.(overallProgress);
                    } : undefined
            });

            uploadedUrls.push(imageUrl);
            completedUploads++;

            // Update progress after each completed upload
            options?.onProgress?.(completedUploads / imageUris.length);
        }

        return uploadedUrls;
    } catch (error) {
        console.error('Error uploading multiple images:', error);
        throw error;
    }
};

export default api; // Export the configured API instance
export { API_BASE_URL };