// This component shows helpful status messages when fetching data from the server.
// For example: "Loading...", or showing an error message with a "Retry" button.
import Button from "./Button";

export default function ApiState({ loading, error, onRetry }) {
  // If nothing is loading and there is no error, don't show anything on screen
  if (!loading && !error) return null;

  return (
    <div
      className="state-box"
      style={{
        marginBottom: "20px",
        // Show a red border if there is an error, otherwise a subtle gray border
        borderColor: error ? "#dc2626" : "#cbd5e1",
      }}
    >
      {/* Show this text while data is being loaded */}
      {loading && (
        <p style={{ margin: 0 }}>Loading records from the backend...</p>
      )}

      {/* Show the error message and a retry button if something goes wrong */}
      {error && (
        <>
          <p style={{ color: "#b91c1c", marginTop: 0 }}>{error}</p>
          <Button variant="outline" size="small" onClick={onRetry}>
            RETRY CONNECTION
          </Button>
        </>
      )}
    </div>
  );
}
