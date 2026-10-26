import { NavLink } from "react-router-dom";

export default function NotFound() {

  return (
    <div className="
      flex
      min-h-screen
      items-center
      justify-center
      bg-slate-100
    ">

      <div className="text-center">

        <h1 className="
          text-7xl
          font-bold
          text-primary
        ">
          404
        </h1>

        <h2 className="
          mt-4
          text-2xl
          font-bold
        ">
          Page Not Found
        </h2>

        <p className="
          mt-2
          text-slate-500
        ">
          The page you are looking for does not exist.
        </p>

        <NavLink
          to="/dashboard"
          className="
            mt-6
            inline-block
            rounded-xl
            bg-primary
            px-5
            py-3
            font-semibold
            text-white
          "
        >
          Go Dashboard
        </NavLink>

      </div>

    </div>
  );
}