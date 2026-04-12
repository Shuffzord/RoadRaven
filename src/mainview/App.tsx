import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <h1>RoadRaven</h1>
      <div className="card"></div>
    </div>
  );
}

export default App;
