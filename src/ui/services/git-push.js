import axios from 'axios'
const baseUrl = "http://localhost:8080/api/v1"

const config = {
  withCredentials: true 
}


const getUser = async (setIsLoading, setData, setAuth, setIsError) => {
  const url = new URL(`http://localhost:8080/auth/success`);  
  console.log(`fetching data from ${url}`);

  await axios(url.toString(), config)
    .then((response) => {        
      console.log(`loading data from: ${url}`)
      const data = response.data;
      console.log(data);      
      setData(data)
      setIsLoading(false);    
    })
    .catch((error) => {        
      console.log(error);
      if (error.response && error.response.status === 401) setAuth(false);      
      else setIsError(true);      
      setIsLoading(false);
    });
};

const getPush = async (id, setIsLoading, setData, setAuth, setIsError) => {
  const url = new URL(`${baseUrl}/push/${id}`);  
  console.log(`fetching data from ${url}`);

  await axios(url.toString(), config)
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

const getPushes = async (setIsLoading, setData, setAuth, setIsError, query={blocked: true, canceled: false, authorised: false, rejected: false}) => {
  const url = new URL(`${baseUrl}/push`);
  url.search = new URLSearchParams(query); 
  console.log(`fetching data from ${url}`);

  await axios(url.toString(),{ withCredentials: true }).then((response) => {        
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
  cancelPush,
  getUser
};
