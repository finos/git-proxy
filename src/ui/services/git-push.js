import axios from 'axios'
const baseUrl = "http://localhost:8080/api/v1"

const config = {
  withCredentials: true 
}

const getPush = async (id, setIsLoading, setData, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}`;
  await axios(url, config)
    .then((response) => {        
      console.log(`loading data from: ${url}`)
      const data = response.data;
      data.diff = data.steps.find(x => x.stepName === 'diff');
      setData(data)
      setIsLoading(false);    
    })
    .catch((error) => {        
      if (error.response && error.response.status === 401) setAuth(false);
      else setIsError(true);      
      setIsLoading(false);
    });
};

const getPushes = async (setIsLoading, setData, setAuth, setIsError) => {
  const url = `${baseUrl}/push`;
  console.log(`loading data from: ${url}`)
  await axios(url,{ withCredentials: true }).then((response) => {        
    const data = response.data;
    setData(data);    
    setIsLoading(false);    
  }).catch((error) => {
    console.log(JSON.stringify(error));
    setIsLoading(false);
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
    setIsLoading(false);
  });
}

const authorisePush = async (id, setAuth, setIsError) => {  
  const url = `${baseUrl}/push/${id}/authorise`;
  console.log(`calling: ${url}`)
  await axios.post(url, {}, { withCredentials: true }).then(() => {            
  }).catch((error) => {
    console.log(JSON.stringify(error));    
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }    
  });
}

const rejectPush = async (id, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}/reject`;
  console.log(`calling: ${url}`)
  await axios.post(url, {}, { withCredentials: true }).then(() => {            
  }).catch((error) => {
    console.log(JSON.stringify(error));    
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }    
  });
}

const cancelPush = async (id, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}/cancel`;
  console.log(`calling: ${url}`)
  await axios.post(url, {}, { withCredentials: true }).then((response) => {        
  }).catch((error) => {
    console.log(JSON.stringify(error));    
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }    
  });
}

export {
  getPush,
  getPushes,
  authorisePush,
  rejectPush,
  cancelPush
};
